const XLIFF = require('./xliff');
const fs = require('fs');
const constants = require('../constants');

class XLIFFStorage {
    constructor() {
        this.xliffFiles = [];
    }

    addXLIFFFile(filePath) {
        const xliff = new XLIFF.XLIFF(filePath);
        xliff.parse(); // Ensure XLIFF data is parsed when added
        this.xliffFiles.push(xliff);
    }

    findTranslation(sourceLanguage, targetLanguage, searchTerm) {
        for (const xliff of this.xliffFiles) {
            if (xliff.getSourceLanguage() === sourceLanguage && xliff.getTargetLanguage() === targetLanguage) {
                const transUnits = xliff.getTransUnits();
                for (const unit of transUnits) {
                    if (unit.sourceText === searchTerm) {
                        return unit.targetText;
                    }
                }
            }
        }
        return null;
    }

    saveToDisk() {
        const outputPath = constants.TranslationCachePath;
        const dataToSave = JSON.stringify(this.xliffFiles, null, 2);
        fs.writeFileSync(outputPath, dataToSave, 'utf-8');
    }

    loadFromDisk() {
        const inputPath = constants.TranslationCachePath;
        if (!fs.existsSync(inputPath)) return;

        const rawData = fs.readFileSync(inputPath, 'utf-8');
        const parsedData = JSON.parse(rawData);

        this.xliffFiles = parsedData.map((xliffData) => {
            const xliff = new XLIFF.XLIFF('');
            Object.assign(xliff, xliffData);
            return xliff;
        });
    }

    clear() {
        this.xliffFiles = [];
        this.saveToDisk();
    }
}

// Create a singleton instance of the ExtensionCache
const xliffStorage = new XLIFFStorage();
xliffStorage.loadFromDisk();

module.exports = xliffStorage;
