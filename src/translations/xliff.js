const fs = require('fs');

class XLIFF {
  constructor(filePath) {
    this.filePath = filePath;
    this.transUnits = [];
    this.sourceLanguage = '';
    this.targetLanguage = '';
  }

  async parse() {
    const data = fs.readFileSync(this.filePath, 'utf-8');
    const sourceLangMatch = data.match(/source-language="(.*?)"/);
    const targetLangMatch = data.match(/target-language="(.*?)"/);
    
    if (sourceLangMatch) {
      this.sourceLanguage = sourceLangMatch[1];
    }
    
    if (targetLangMatch) {
      this.targetLanguage = targetLangMatch[1];
    }

    const transUnitRegex = /<trans-unit id="(.*?)">(.*?)<source[^>]*>([^<]*)<\/source>(.*?)<target[^>]*>([^<]*)<\/target>/gs;
    let match;

    while ((match = transUnitRegex.exec(data)) !== null) {
      const id = match[1];
      const sourceText = match[3].trim(); // Trim to remove leading/trailing whitespace
      const targetText = match[5].trim();

      this.transUnits.push({ id, sourceText, targetText });
    }
  }

  getTransUnits() {
    return this.transUnits;
  }

  getSourceLanguage() {
    return this.sourceLanguage;
  }

  getTargetLanguage() {
    return this.targetLanguage;
  }

  findTargetTextBySource(sourceText) {
    for (const unit of this.transUnits) {
      if (unit.sourceText === sourceText) {
        return unit.targetText;
      }
    }
    return null; // Return null if not found
  }
}
exports.XLIFF = XLIFF;
