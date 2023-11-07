const vscode = require('vscode');

const generalFunctions = require('../generalFunctions');
const telemetry = require('../telemetry');
const openAITranslator = require('../translations/openAITranslator');


const targetLanguageRegex = /\$TargetLanguage/g;
const targetLanguage2Regex = /\$TargetLanguage2/g;

exports.RegisterCommands = (context) => {
    context.subscriptions.push(vscode.commands.registerCommand('al-toolbox.enterOpenAIAPIKey', () => {
        generalFunctions.setAPIKey(context);
    }));
    context.subscriptions.push(vscode.commands.registerTextEditorCommand('al-toolbox.translateCurrentFile', async (editor) => {
        let numberOfTranslations; 
        
        editor.edit(editBuilder => {
            numberOfTranslations = translateCurrentFile(editBuilder, editor.document);
        })
            .then(() => vscode.window.showInformationMessage(numberOfTranslations +' translation(s) created.'))
    }));    
}


/**
 * @param {vscode.TextEditorEdit} editBuilder
 * @param {vscode.TextDocument} document
 */
function translateCurrentFile(editBuilder, document) {
    telemetry.sendTranslateCurrentFileEvent();

    let text = document.getText();

    const targetLanguage1 = generalFunctions.snippetTargetLanguage();
    const targetLanguage2 = generalFunctions.snippetTargetLanguage2();

    // Todo: Locked
    const withCommentRegex = new RegExp(`(?<whitespace>[ \t]*)(?<identifier>(?:\\S*\\s*:\\s*Label)|(?:(?:Caption|ToolTip))\\s*=)\\s*'(?<enu>[^']+)'.*;`, 'gi')
    const targetLanguagesRegex = new RegExp(`(?:${targetLanguage1}="(?<targetLanguage1>[^"]*)")|(?:${targetLanguage2}="(?<targetLanguage2>[^"]*)")`, 'gi');

    let match;
    let locationsToProcess = [];
    while((match = withCommentRegex.exec(text)) != null){
        const languagesMatch = targetLanguagesRegex.exec(match[0]);
        let identifier = '';
        let translationENU = '';
        let whiteSpace = '';
        let translationTargetLanguage1 = '';
        let translationTargetLanguage2 = '';    

        if (match.groups.enu) {
            translationENU = match.groups.enu;
        }
        
        if (match.groups.identifier) {
            identifier = match.groups.identifier;
        }

        if (match.groups.whitespace) {
            whiteSpace = match.groups.whitespace;
        }

        if (languagesMatch) {
            if (languagesMatch.groups.targetLanguage1 !== undefined) {
                translationTargetLanguage1 = languagesMatch.groups.targetLanguage1;
            } 
            if (languagesMatch.groups.targetLanguage2 !== undefined) {
                translationTargetLanguage2 = languagesMatch.groups.targetLanguage2;
            }
        }

        if (translationENU !== '') {
            if ((targetLanguage1 !== '' && translationTargetLanguage1 === '') || (targetLanguage2 !== '' && translationTargetLanguage2 === '')) {                   
                locationsToProcess.push({
                    index: match.index,
                    whiteSpace: whiteSpace,
                    identifier: identifier,
                    enu: translationENU,
                    targetLanguage1: translationTargetLanguage1,
                    targetLanguage2: translationTargetLanguage2
                });
            }
        }
    }

    locationsToProcess.forEach(location => {
        completeLocation(location, targetLanguage1, targetLanguage2)
            .then((location) => {
                let lineInfo = getLineNumbersForLocation(text, location.index);
                let line = document.lineAt(lineInfo.start);  
                let lineValue = getLineValue(location, targetLanguage1, targetLanguage2);
                editBuilder.replace(line.range, lineValue);
                console.log(`Index: "${location.index}", Identifier: ${location.identifier}, ENU: "${location.enu}", ${targetLanguage1}: "${location.targetLanguage1}", ${targetLanguage2}: "${location.targetLanguage2}"`);
            });
    });

    // locationsToProcess.forEach(location => {
    //     let lineInfo = getLineNumbersForLocation(text, location.index);
    //     let line = document.lineAt(lineInfo.start);  
    //     let lineValue = getLineValue(location, targetLanguage1, targetLanguage2);
    //     editBuilder.replace(line.range, lineValue);
    //     console.log(`Index: "${location.index}", Identifier: ${location.identifier}, ENU: "${location.enu}", ${targetLanguage1}: "${location.targetLanguage1}", ${targetLanguage2}: "${location.targetLanguage2}"`);
    // });
}

async function completeLocation(location, targetLanguage1, targetLanguage2) {
    const apiKey = await generalFunctions.getAPIKey();
    const translator = new openAITranslator.OpenAITranslator(apiKey);
  
    if (targetLanguage1 !== '' && location.targetLanguage1 === '') {
      const translation = await translator.translate(location.enu, 'enu', targetLanguage1);
      location.targetLanguage1 = translation;
    }
  
    if (targetLanguage2 !== '' && location.targetLanguage2 === '') {
      const translation = await translator.translate(location.enu, 'enu', targetLanguage2);
      location.targetLanguage2 = translation;
    }
  
    return location;
}
    
function getLineValue(location, targetLanguage1, targetLanguage2) {    
    let newLineValue = `${location.whiteSpace}${location.identifier} '${location.enu}'`;

    if (targetLanguage1 !== "") {
        newLineValue += `, Comment='${targetLanguage1}="${location.targetLanguage1}"`;
    }

    if (targetLanguage2 !== "") {
        newLineValue += `,${targetLanguage2}="${location.targetLanguage2}"'`;
    }
    else {
        newLineValue += `'`;
    }

    newLineValue += `;`;
    return newLineValue;
}

function getLineNumbersForLocation(text, start) {
    let tempString = text.substring(0, start);
    const startLineNo = tempString.split(/\n/).length - 1;
    tempString = text.substring(start, -1);
    return {
        start: startLineNo,
        end: startLineNo + tempString.split(/\n/).length - 1
    }
}
