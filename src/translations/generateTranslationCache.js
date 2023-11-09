const generalFunctions = require('../generalFunctions');
const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const util = require('util');
const JSZip = require('jszip');
const vscode = require('vscode');

async function createTranslationCache() {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating translation cache...",
        cancellable: true
    }, async (progress, cancellationToken) => {
        const packageCachePath = generalFunctions.getPackageCachePath();       
        const translationCachePath = generalFunctions.getTranslationCachePath();
        removeDirectoryContents(translationCachePath);

        const files = await findFiles(packageCachePath, 'microsoft*.app')

        await extractAllZipFiles(files, translationCachePath);
        await moveXlfFilesToRoot(translationCachePath);
    }).then(() => vscode.window.showInformationMessage('Translation cache succesfully generated'))
}
exports.createTranslationCache = createTranslationCache;

async function findFiles(directoryToSearch, pattern) {
    const globPromise = util.promisify(glob);

    try {
        const files = await globPromise(pattern, {
            cwd: directoryToSearch,
            nocase: true,
            absolute: true
        });
        return files;
    } catch (error) {
        throw `An error occurred while locating the files: ${error}`;
    }
}

async function extractAllZipFiles(zipFilePaths, outputDirectory) {
    for (const zipFilePath of zipFilePaths) {
        try {
            await extractZipToDirectory(zipFilePath, outputDirectory);
            console.log(`Extracted ${zipFilePath}`);
        } catch (error) {
            console.error(`An error occurred during extraction of ${zipFilePath}: ${error}`);
        }
    }
}

async function extractZipToDirectory(zipFilePath, outputDirectory) {
    try {
        const zipData = await fs.readFile(zipFilePath);
        const zip = new JSZip();
        const zipFiles = await zip.loadAsync(zipData);

        // Create a subdirectory based on the zip file name
        const zipFileName = path.basename(zipFilePath, path.extname(zipFilePath));
        const subDirectory = path.join(outputDirectory, zipFileName);

        // Create the subdirectory if it doesn't exist
        await fs.mkdir(subDirectory, { recursive: true });

        for (const [entryName, content] of Object.entries(zipFiles.files)) {            
            // Split the entry name into parts to simulate directory structure
            const entryParts = entryName.split('/');
            let currentDirectory = subDirectory;

            // Create directories for each part of the entry name
            for (let i = 0; i < entryParts.length - 1; i++) {
                currentDirectory = path.join(currentDirectory, entryParts[i]);
                await fs.mkdir(currentDirectory, { recursive: true });
            }

            // Extract files
            if (!content.dir) {
                const entryPath = path.join(subDirectory, entryName);
                const entryData = await content.async('nodebuffer');
                await fs.writeFile(entryPath, entryData);
            }
        }
    } catch (error) {
        throw error;
    }
}

async function moveXlfFilesToRoot(rootDirectory) {
    try {
        async function processDirectory(directory) {
            const items = await fs.readdir(directory);

            for (const item of items) {
                const itemPath = path.join(directory, item);
                const stats = await fs.lstat(itemPath);

                if (stats.isDirectory()) {
                    // If it's a subdirectory, recursively process it
                    await processDirectory(itemPath);
                    await fs.rmdir(itemPath);
                } else if (path.extname(item) === '.xlf') {
                    // If it's an XLF file, move it to the root directory
                    await fs.rename(itemPath, path.join(rootDirectory, item));
                } else {
                    // If it's neither a directory nor an XLF file, remove it
                    await fs.unlink(itemPath);
                }
            }
        }

        // Start the recursive process from the root directory
        await processDirectory(rootDirectory);
    } catch (error) {
        console.error(`An error occurred while locating the xlf files in directory ${rootDirectory}: ${error}`);
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