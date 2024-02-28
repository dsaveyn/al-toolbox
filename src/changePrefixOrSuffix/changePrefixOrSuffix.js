const constants = require('../constants');
const fileManagement = require('../fileManagement/fileManagement');
const workspaceManagement = require('../fileManagement/workspaceManagement');
const vscode = require('vscode');

/**
 * Changes object (and field) prefix in all *.al files
 * @param {string} currPrefix
 * @param {string} newPrefix
 * @returns {Promise<Object>}
 */
exports.changeObjectPrefix = async function changeObjectPrefix(currPrefix, newPrefix) {
    const nameRegex = `("${currPrefix}[^"]+"|${currPrefix}\\w+)`;
    replacePrefixOrSuffixInALFiles(nameRegex, currPrefix, newPrefix, "prefix");
}

/**
 * Changes prefix in '.vscode/settings.json'
 * @param {string} currPrefix
 * @param {string} newPrefix
 * @returns {Promise<Object>}
 */
exports.changePrefixSettings = async function changePrefixSettings(currPrefix, newPrefix){
    return changePrefixOrSuffixInSettingsFile(currPrefix, newPrefix);
}

/**
 * Changes object (and field) suffix in all *.al files
 * @param {string} currSuffix
 * @param {string} newSuffix
 * @returns {Promise<Object>}* 
 */
exports.changeObjectSuffix = async function changeObjectSuffix(currSuffix, newSuffix) {
    const nameRegex = `("[^"]+${currSuffix}"|\\w+${currSuffix})`;
    return replacePrefixOrSuffixInALFiles(nameRegex, currSuffix, newSuffix, "suffix");
}

/**
 * Changes suffix in '.vscode/settings.json'
 * @param {string} currSuffix
 * @param {string} newSuffix
 * @returns {Promise<Object>}* 
 */
exports.changeSuffixSettings = async function changeSuffixSettings(currSuffix, newSuffix){
    return changePrefixOrSuffixInSettingsFile(currSuffix, newSuffix);
}

/**
 * Generic function to change prefixes or suffixes in AL files
 * @param {string} nameRegex
 * @param {string} currValue
 * @param {string} newValue
 * @param {string} title
 * @returns {Promise<Object>}
 */
async function replacePrefixOrSuffixInALFiles(nameRegex, currValue, newValue, title) {
    const objectTypeRegex = '(' + Object.entries(constants.AlObjectTypes)
        .map((value) => value[1]).join('|') + ')';
    
    const objectPrefixSuffixRegex = new RegExp(
        `(?<=^\\s*${objectTypeRegex}(\\s+\\d+)?\\s+)${nameRegex}`, 'gi');
    const fieldPrefixSuffixRegex = new RegExp(
        `(?<=field\\((\\d+;\\s*))${nameRegex}`, 'gi');
    const currPrefixSuffixRegex = new RegExp(currValue);
    
    const currWorkspace = workspaceManagement.getCurrentWorkspaceFolderPath()

    let files = await vscode.workspace.findFiles('**/*.al');
    files = files.filter(file => file.fsPath.startsWith(currWorkspace));

    const fileProgressIncrement = 100 / files.length;

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Updating ${title}...`,
        cancellable: false
    }, async progress => {
        let objectResults = [];
        let fieldResults = [];
        for (let i = 0; i < files.length; ++i) {
            const textDocument = await vscode.workspace.openTextDocument(files[i]);
            let results = await fileManagement.renameAllWithoutQuotes(textDocument, objectPrefixSuffixRegex, currPrefixSuffixRegex, newValue);
            objectResults = objectResults.concat(results);
            results = await fileManagement.renameAllWithoutQuotes(textDocument, fieldPrefixSuffixRegex, currPrefixSuffixRegex, newValue);
            fieldResults = fieldResults.concat(results);
            progress.report({increment: fileProgressIncrement});
        }
        return {
            objectResults: objectResults,
            fieldResults: fieldResults
        };
    });
}

/**
 * Changes prefix in '.vscode/settings.json'
 * @param {string} currValue
 * @param {string} newValue
 */
async function changePrefixOrSuffixInSettingsFile(currValue, newValue){
    return fileManagement.getSettingsFile()
        .then(async file => {
            const textDocument = await vscode.workspace.openTextDocument(file);
            return fileManagement.replaceAll(textDocument, new RegExp(`(?<=:\\s*")${currValue}(?=")`, 'g'), newValue);
        });
}