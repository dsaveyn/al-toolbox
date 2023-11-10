const generalFunctions = require('../generalFunctions');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const util = require('util');
const JSZip = require('jszip');
const vscode = require('vscode');
const xliffStorage = require('./xliffStorage');

async function generateTranslationCache() {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating translation cache...",
        cancellable: true
    }, async (progress, cancellationToken) => {
        const tempWorkingDir = await generalFunctions.createTempDirectory();

        await extractXLIFFFiles(tempWorkingDir);
        await readXLIFFFilesIntoStorage(tempWorkingDir)     

        await fs.rmdir(tempWorkingDir, { recursive: true });
    }).then(() => vscode.window.showInformationMessage('Translation cache succesfully generated'))
}
exports.generateTranslationCache = generateTranslationCache;

async function findTranslationInCache(textToTranslate, sourceLanguage, targetLanguage, context) {   
    return xliffStorage.findTranslation(sourceLanguage, targetLanguage, textToTranslate);
}
exports.findTranslationInCache = findTranslationInCache;

async function extractXLIFFFiles(destinationPath) {
    const packageCachePath = generalFunctions.getPackageCachePath(); 
    const targetLanguage1 = generalFunctions.snippetTargetLanguage();
    const targetLanguage2 = generalFunctions.snippetTargetLanguage2();

    removeDirectoryContents(destinationPath);

    let appFilesToExtract = [];
    await findAppFileWithHighestVersion(packageCachePath, 'microsoft_application*.app', appFilesToExtract);
    await findAppFileWithHighestVersion(packageCachePath, 'microsoft_system application*.app', appFilesToExtract);
    await findAppFileWithHighestVersion(packageCachePath, 'microsoft_base application*.app', appFilesToExtract);        

    for(const appFile of appFilesToExtract) {
        await extractXLIFF(appFile,destinationPath, [targetLanguage1, targetLanguage2]);
    }
}

async function findAppFileWithHighestVersion(sourcePath, pattern, appFiles) {
    const files = await findFiles(sourcePath, pattern)

    if (files.length > 0) {
        files.sort((a, b) => b.localeCompare(a));
        appFiles.push(files[0]);
    }        
}

async function readXLIFFFilesIntoStorage(sourcePath) {    
    const xlfFiles = await findFiles(sourcePath, '*.xlf')

    xliffStorage.clear();
    for(const xlfFile of xlfFiles) {
        xliffStorage.addXLIFFFile(xlfFile)
    }    

    xliffStorage.saveToDisk();   
}

async function findFiles(directoryToSearch, pattern) {
    const globPromise = util.promisify(glob);

    try {
        const files = await globPromise(pattern, {
            cwd: directoryToSearch,
            nocase: true,
            absolute: true,
        });
        return files;
    } catch (error) {
        throw new Error(`An error occurred while locating the files: ${error}`);
    }
}

async function removeDirectoryContents(directoryToProcess) {
    const items = await fs.readdir(directoryToProcess);

    for (const item of items) {
        const itemPath = path.join(directoryToProcess, item);
        const stats = await fs.lstat(itemPath);

        if (stats.isDirectory()) {
            await fs.rmdir(itemPath, { recursive: true})
        } else {
            await fs.unlink(itemPath);
        }
    }
}

function extractXLIFF(xliffFilePath, outputDirectory, languages) {
    return new Promise((resolve, reject) => {
      fs.readFile(xliffFilePath)
        .then(data => JSZip.loadAsync(data))
        .then(zip => {
          const promises = [];
  
          zip.forEach((relativePath, zipEntry) => {
            const fileName = path.basename(relativePath).toLowerCase();
  
            if (
              languages.some(lang => fileName.includes(`.${lang.toLowerCase()}.xlf`)) &&
              !/\.g\.xlf$/i.test(relativePath)
            ) {
              const outputPath = path.join(outputDirectory, fileName);
  
              promises.push(
                zip.file(relativePath).async('string').then(content => fs.writeFile(outputPath, content))
              );
            }
          });
  
          return Promise.all(promises);
        })
        .then(() => resolve('Extraction complete.'))
        .catch(error => reject(error));
    });
}