const axios = require('axios');

class OllamaAdapter {
  static async generate(prompt, systemPrompt, history, imageBase64 = null, host = 'http://localhost:11434', model = 'phi3') {
    const url = `${host}/api/chat`;
    const startTime = Date.now();

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    history.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    const userMessage = { role: 'user', content: prompt };
    if (imageBase64) {
      // Multimodal support (e.g. for Llava/Bakllava local vision)
      userMessage.images = [imageBase64];
    }
    messages.push(userMessage);

    const requestBody = {
      model: model,
      messages: messages,
      stream: false,
      options: {
        num_predict: 150,
        temperature: 0.7
      }
    };

    try {
      const response = await axios.post(url, requestBody, { timeout: 15000 });
      const latencyMs = Date.now() - startTime;

      if (response.data && response.data.message) {
        const text = response.data.message.content;
        return { text, model: `ollama/${model}`, latencyMs };
      } else {
        throw new Error("Invalid response format from Ollama API.");
      }
    } catch (err) {
      throw new Error(`Ollama API Request Failed: ${err.message}`);
    }
  }
}

module.exports = OllamaAdapter;
