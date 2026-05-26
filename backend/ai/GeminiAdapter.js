const axios = require('axios');

class GeminiAdapter {
  static async generate(prompt, systemPrompt, history, imageBase64 = null, apiKey) {
    if (!apiKey) throw new Error("Gemini API key is not configured.");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const startTime = Date.now();

    // Map system prompt
    const contents = [];

    // Map history to Gemini format (user/model)
    history.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    // Map user current prompt (with optional image)
    const currentParts = [{ text: prompt }];
    if (imageBase64) {
      currentParts.push({
        inlineData: {
          mimeType: "image/png",
          data: imageBase64
        }
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    const requestBody = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        maxOutputTokens: 150,
        temperature: 0.7
      }
    };

    try {
      const response = await axios.post(url, requestBody, { timeout: 20000 });
      const latencyMs = Date.now() - startTime;
      
      if (
        response.data && 
        response.data.candidates && 
        response.data.candidates[0] && 
        response.data.candidates[0].content && 
        response.data.candidates[0].content.parts
      ) {
        const text = response.data.candidates[0].content.parts[0].text;
        return { text, model: 'gemini-3.5-flash', latencyMs };
      } else {
        throw new Error("Invalid response format from Gemini API.");
      }
    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Gemini API Request Failed: ${errMsg}`);
    }
  }
}

module.exports = GeminiAdapter;
