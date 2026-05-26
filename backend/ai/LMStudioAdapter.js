const axios = require('axios');

class LMStudioAdapter {
  static async generate(prompt, systemPrompt, history, host = 'http://localhost:1234') {
    const url = `${host}/v1/chat/completions`;
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
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    };

    try {
      const response = await axios.post(url, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      const latencyMs = Date.now() - startTime;

      if (response.data && response.data.choices && response.data.choices[0]) {
        const text = response.data.choices[0].message.content;
        // Fetch model name dynamically from response if present
        const modelName = response.data.model || 'lmstudio';
        return { text, model: `lmstudio/${modelName}`, latencyMs };
      } else {
        throw new Error("Invalid response format from LMStudio API.");
      }
    } catch (err) {
      throw new Error(`LMStudio API Request Failed: ${err.message}`);
    }
  }
}

module.exports = LMStudioAdapter;
