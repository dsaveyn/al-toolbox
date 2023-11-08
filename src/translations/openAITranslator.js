const ai = require('openai');

class OpenAITranslator {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async translate(textToTranslate, sourceLanguage, targetLanguage) {
    try {

      const openai =  new ai.OpenAI({
        apiKey: this.apiKey,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            "role": "system",
            "content": `You will be provided with a sentence in ${sourceLanguage}, and your task is to translate it into ${targetLanguage}. If you cannot translate it, return an empty string.`
          },
          {
            "role": "user",
            "content": `${textToTranslate}`
          }
        ],
        temperature: 0,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      if (response.choices && response.choices.length > 0) {
        return response.choices[0].message.content;
      } else {
        throw new Error('Translation failed');
      }
    } catch (error) {
      throw error;
    }
  }
}

exports.OpenAITranslator = OpenAITranslator;