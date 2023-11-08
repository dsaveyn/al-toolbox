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
        const targetLanguage1 = generalFunctions.snippetTargetLanguage();
        const targetLanguage2 = generalFunctions.snippetTargetLanguage2();
        
        let numberOfTranslations = 0; 
        
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Translating file...",
            cancellable: true
        }, async (progress, cancellationToken) => {
            getLocationsToUpdate(editor.document, targetLanguage1, targetLanguage2, context)
            .then((locations) => {
                if (cancellationToken.isCancellationRequested) 
                    return;

                editor.edit(editBuilder => {
                    numberOfTranslations = updateLocations(editBuilder, editor.document, locations, targetLanguage1, targetLanguage2)
                }).then(() => vscode.window.showInformationMessage(numberOfTranslations +' translation(s) created.'));
            })
            .catch((error) => {
                vscode.window.showErrorMessage(
                    'Translations could not be created.',
                )                
                throw(error);
            }); 

        });
    }));    
}

function updateLocations(editBuilder, document, locations, targetLanguage1, targetLanguage2) {
    let text = document.getText();

    locations.forEach(location => {
        let lineInfo = getLineNumbersForLocation(text, location.index);
        let line = document.lineAt(lineInfo.start);  
        let lineValue = createLineText(location, targetLanguage1, targetLanguage2);
        editBuilder.replace(line.range, lineValue);
    });

    return locations.length;
}

async function getLocationsToUpdate(document, targetLanguage1, targetLanguage2, context) {

    let text = document.getText();

    const withCommentRegex = new RegExp(`(?!.*\\bLocked\\s*=\\s*true\\b)(?<whitespace>[ \t]*)(?<identifier>(?:\\S*\\s*:\\s*Label)|(?:(?:Caption|ToolTip))\\s*=)\\s*'(?<enu>[^']+)'.*;`, 'gi')
    const targetLanguagesRegex = new RegExp(`(?:${targetLanguage1}="(?<targetLanguage1>[^"]*)")|(?:${targetLanguage2}="(?<targetLanguage2>[^"]*)")`, 'gi');

    let match;
    let locationsToProcess = [];
    while((match = withCommentRegex.exec(text)) != null){            
        const translations = extractTargetLanguageTranslations(match[0], targetLanguage1, targetLanguage2)

        if (translations.translationTargetLanguage1 == "" || translations.translationTargetLanguage2 == '') {
            locationsToProcess.push({
                index: match.index,
                whiteSpace: match.groups.whitespace ? match.groups.whitespace : '',
                identifier: match.groups.identifier,
                enu: match.groups.enu,
                targetLanguage1: translations.translationTargetLanguage1,
                targetLanguage2: translations.translationTargetLanguage2
            });
        };
    }

    const results = await Promise.all(
        locationsToProcess.map(async (location) => {
            const result = await completeLocation(location, targetLanguage1, targetLanguage2, context);
            return result;
        })
    )

    return results;
}

async function completeLocation(location, targetLanguage1, targetLanguage2, context) {
    const apiKey = await generalFunctions.getAPIKey(context);
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
    
function createLineText(location, targetLanguage1, targetLanguage2) {    
    let lineText = `${location.whiteSpace}${location.identifier} '${location.enu}'`;

    if (targetLanguage1 !== "") {
        lineText += `, Comment='${targetLanguage1}="${location.targetLanguage1.replace(`'`,`''`)}"`;
    }

    if (targetLanguage2 !== "") {
        lineText += `,${targetLanguage2}="${location.targetLanguage2.replace(`'`,`''`)}"'`;
    }
    else {
        lineText += `'`;
    }

    lineText += `;`;
    return lineText;
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

function extractTargetLanguageTranslations(input, targetLanguage1, targetLanguage2) {
    const extractTargetLanguagesRegex = new RegExp(
        `(?:${targetLanguage1}="(?<translationTargetLanguage1>[^"]*)")|(?:${targetLanguage2}="(?<translationTargetLanguage2>[^"]*)")`,
        'g'
    );
    const result = {
        translationTargetLanguage1: '',
        translationTargetLanguage2: ''
    };

    let match;
    while ((match = extractTargetLanguagesRegex.exec(input)) !== null) {
        if (match[1]) {
            result.translationTargetLanguage1 = match[1];
        } else if (match[2]) {
            result.translationTargetLanguage2 = match[2];
        }
    }

    return result;
}