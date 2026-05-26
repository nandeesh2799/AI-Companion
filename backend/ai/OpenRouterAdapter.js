const axios = require('axios');

class OpenRouterAdapter {
  static async generate(prompt, systemPrompt, history, apiKey) {
    // OpenRouter has free tier models available even with a basic key or if configured
    const key = apiKey || "sk-or-v1-placeholder"; 
    const url = 'https://openrouter.ai/api/v1/chat/completions';
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
      model: 'mistralai/mistral-7b-instruct:free',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    };

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/nanu/vtuber-companion',
          'X-Title': 'Aria VTuber Companion'
        },
        timeout: 20000
      });
      const latencyMs = Date.now() - startTime;

      if (response.data && response.data.choices && response.data.choices[0]) {
        const text = response.data.choices[0].message.content;
        return { text, model: 'openrouter/mistral-7b', latencyMs };
      } else {
        throw new Error("Invalid response format from OpenRouter API.");
      }
    } catch (err) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`OpenRouter API Request Failed: ${errMsg}`);
    }
  }
}

module.exports = OpenRouterAdapter;
