const axios = require('axios');

class GroqAdapter {
  static async generate(prompt, systemPrompt, history, apiKey) {
    if (!apiKey) throw new Error("Groq API key is not configured.");

    const url = 'https://api.groq.com/openai/v1/chat/completions';
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

    messages.push({ role: 'user', content: prompt });

    const requestBody = {
      model: 'llama-3.1-8b-instant',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    };

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });
      const latencyMs = Date.now() - startTime;

      if (response.data && response.data.choices && response.data.choices[0]) {
        const text = response.data.choices[0].message.content;
        return { text, model: 'groq/llama-3.1-8b', latencyMs };
      } else {
        throw new Error("Invalid response format from Groq API.");
      }
    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Groq API Request Failed: ${errMsg}`);
    }
  }
}

module.exports = GroqAdapter;
