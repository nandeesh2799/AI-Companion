const GeminiAdapter = require('./GeminiAdapter.js');
const GroqAdapter = require('./GroqAdapter.js');
const OpenRouterAdapter = require('./OpenRouterAdapter.js');
const OllamaAdapter = require('./OllamaAdapter.js');
const LMStudioAdapter = require('./LMStudioAdapter.js');

class AIRouter {
  static async generateResponse({ message, systemPrompt, history, imageBase64 = null, config }) {
    const primary = config.ai_provider || 'gemini';
    const queue = [primary];
    
    // Fill the fallback queue with remaining providers in standard priority
    const allProviders = ['gemini', 'groq', 'openrouter', 'ollama', 'lmstudio'];
    allProviders.forEach(p => {
      if (!queue.includes(p)) {
        queue.push(p);
      }
    });

    console.log(`Starting LLM Routing. Priority queue: ${queue.join(' -> ')}`);

    for (let i = 0; i < queue.length; i++) {
      const provider = queue[i];
      try {
        console.log(`Attempting LLM provider: ${provider}`);
        let result = null;

        switch (provider) {
          case 'gemini':
            result = await GeminiAdapter.generate(
              message,
              systemPrompt,
              history,
              imageBase64,
              config.gemini_key || process.env.GEMINI_API_KEY
            );
            break;
            
          case 'groq':
            result = await GroqAdapter.generate(
              message,
              systemPrompt,
              history,
              config.groq_key || process.env.GROQ_API_KEY
            );
            break;
            
          case 'openrouter':
            result = await OpenRouterAdapter.generate(
              message,
              systemPrompt,
              history,
              config.openrouter_key || process.env.OPENROUTER_API_KEY
            );
            break;
            
          case 'ollama':
            result = await OllamaAdapter.generate(
              message,
              systemPrompt,
              history,
              imageBase64,
              config.ollama_host || process.env.OLLAMA_HOST || 'http://localhost:11434',
              config.ollama_model || process.env.OLLAMA_MODEL || 'phi3'
            );
            break;

          case 'lmstudio':
            result = await LMStudioAdapter.generate(
              message,
              systemPrompt,
              history,
              config.lmstudio_host || 'http://localhost:1234'
            );
            break;
        }

        if (result && result.text) {
          console.log(`Successfully generated response using ${result.model} in ${result.latencyMs}ms`);
          return result;
        }
      } catch (err) {
        console.warn(`Provider ${provider} failed:`, err.message);
        // Continue to next provider in queue
      }
    }

    // Canned Tsundere fallback if everything fails
    console.error("All AI providers in fallback chain failed.");
    return {
      text: "H-huh? All my brain cores are offline... Are you playing with the wires again, baka? Check your internet and API settings! [EMOTION:angry]",
      model: 'canned-fallback',
      latencyMs: 0
    };
  }
}

module.exports = AIRouter;
