const vscode = require('vscode');
const fileManagement = require('./fileManagement/fileManagement');
const fs = require('fs');

/**
 * @param {string} string 
 */
exports.escapeRegExp = function (string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

exports.useAlRegions = async function () {
    if (vscode.workspace.getConfiguration('ALTB').get('UseAlRegions')) {
        const json = await fileManagement.getAppFileContents();
        if (json && json.runtime) {
            const runtime = parseInt(json.runtime.split('.')[0]);
            if (runtime >= 6)
                return true;
        }
    }
    return false;
}

exports.usePromotedActionProperties = async function () {
    const json = await fileManagement.getAppFileContents();
    if (json && json.runtime && json.features) {
        const noPromotedActionProperties = parseInt(json.features.indexOf("NoPromotedActionProperties")) !== -1;
        const runtime = parseInt(json.runtime.split('.')[0]);
        return !(noPromotedActionProperties && runtime >= 10);
    }

    return false;
}

exports.snippetTargetLanguage = function () {
    let uri = vscode.window.activeTextEditor.document.uri;
    return vscode.workspace.getConfiguration('ALTB', uri).get('snippetTargetLanguage');
}

exports.snippetTargetLanguage2 = function () {
    let uri = vscode.window.activeTextEditor.document.uri;
    return vscode.workspace.getConfiguration('ALTB', uri).get('snippetTargetLanguage2');
}

exports.removeDuplicates = function (arr) {
    var arrayWithoutDuplicates = [];

    arr.forEach(element => {
        if (arrayWithoutDuplicates.find(key => key.toUpperCase() === element.toUpperCase()) == undefined) {
            arrayWithoutDuplicates.push(element);
        }
    });

    return arrayWithoutDuplicates;
}

exports.getDiagnosticCode = function (diagnostic) {
    return (diagnostic.code.value !== undefined ? diagnostic.code.value : diagnostic.code);
}

exports.telemetryIdentifier = function () {
    let uri = vscode.window.activeTextEditor.document.uri;
    return vscode.workspace.getConfiguration('ALTB', uri).get('TelemetryIdentifier');
}

exports.useSimpleFunctionSnippets = function () {
    return vscode.workspace.getConfiguration('ALTB').get('UseSimpleFunctionSnippets');
}

async function setAPIKey(context) {
    vscode.window.showInputBox({
        placeHolder: 'Enter your OpenAI API Key',
        prompt: 'API Key will be securely stored',
        password: true,
        })
            .then((apiKey) => {
                if (apiKey) {
                    context.secrets.store('al-toolbox.openAIKey', apiKey)
                        .then(() => {
                            vscode.window.showInformationMessage('Open API Key successfully set')
                        });                    
                }
            });      
}
exports.setAPIKey = setAPIKey
 
exports.getAPIKey = async function getAPIKey(context) {
    const apiKey = await context.secrets.get('al-toolbox.openAIKey');

    if (!apiKey) {
        const setAPIKeyAction = 'Set OpenAI API Key';

        vscode.window.showErrorMessage(
            'OpenAI API Key must be set',
            setAPIKeyAction
        )
            .then((selectedAction) => {
                if (selectedAction == setAPIKeyAction) {
                    setAPIKey(context);
                }
            });

        throw 'OpenAI API Key must be set';
    } else {
        return apiKey;
    }
}

exports.getPackageCachePath = function getPackageCachePath() {
    let packageCachePath = vscode.workspace.getConfiguration('al').get('packageCachePath');
    
    if (!packageCachePath) {
        const currentWorkspaceFolder = vscode.workspace.workspaceFolders[0];
        packageCachePath = vscode.Uri.joinPath(currentWorkspaceFolder.uri, '.alpackages').path.slice(1);
    }
    
    packageCachePath = packageCachePath.replace(new RegExp("/", "g"), '\\')

    if (!fs.existsSync(packageCachePath)) {
        vscode.window.showErrorMessage('Package cache could not be determined.');
        throw 'Package cache could not be determined.';
    }     

    return packageCachePath;
}

exports.createTempDirectory = async function createTempDirectory() {
    const { sep } = require('path'); 
    const fs = require('fs').promises
    const os = require('os');;
    const tmpDir = os.tmpdir();  

    return await fs.mkdtemp(`${tmpDir}${sep}`)
}