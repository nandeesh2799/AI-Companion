const db = require('./database.js');
const axios = require('axios');

class VectorMemory {
  // Compute Cosine Similarity between two vector arrays
  static cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Generate embedding using Ollama or Gemini (based on active configuration)
  static async getEmbedding(text, config) {
    const provider = config.ai_provider || 'gemini';
    
    // 1. Local privacy-first Ollama Embedding
    if (provider === 'ollama' && config.ollama_host) {
      try {
        const response = await axios.post(`${config.ollama_host}/api/embeddings`, {
          model: config.ollama_model || 'phi3',
          prompt: text
        }, { timeout: 4000 });
        if (response.data && response.data.embedding) {
          return response.data.embedding;
        }
      } catch (err) {
        console.warn("Ollama embedding failed, falling back to local bag-of-words:", err.message);
      }
    }

    // 2. Cloud Gemini Embedding
    if (provider === 'gemini' && config.gemini_key) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${config.gemini_key}`;
        const response = await axios.post(url, {
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: text }] }
        }, { timeout: 4000 });
        if (response.data && response.data.embedding && response.data.embedding.values) {
          return response.data.embedding.values;
        }
      } catch (err) {
        console.warn("Gemini embedding failed, falling back to local bag-of-words:", err.message);
      }
    }

    // 3. Fallback: Local Bag-of-words pseudo-embedding (Grayscale token counting)
    // Ensures fully offline local capability without external tools
    return this.generateLocalPseudoEmbedding(text);
  }

  // Helper local vocabulary hashing for pseudo-embeddings (128-dimensions)
  static generateLocalPseudoEmbedding(text) {
    const vector = new Array(128).fill(0);
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(word => {
      // Simple hash index mapping
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 31 + word.charCodeAt(i)) % 128;
      }
      vector[hash] += 1;
    });
    // L2 Normalize
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }

  // Save a semantic memory chunk to SQLite
  static async addMemory(characterId, content, config) {
    try {
      const embedding = await this.getEmbedding(content, config);
      const stmt = db.prepare('INSERT INTO memories (character_id, content, embedding) VALUES (?, ?, ?)');
      stmt.run(characterId, content, JSON.stringify(embedding));
    } catch (err) {
      console.error("Failed to add memory:", err);
    }
  }

  // Perform cosine-similarity retrieval
  static async findSimilarMemories(characterId, queryText, limit, config) {
    try {
      const queryEmbedding = await this.getEmbedding(queryText, config);
      
      // Fetch all memories for the character
      const stmt = db.prepare('SELECT id, content, embedding FROM memories WHERE character_id = ?');
      const rows = stmt.all(characterId);

      const results = rows.map(row => {
        let embeddingArray = [];
        try {
          embeddingArray = JSON.parse(row.embedding);
        } catch (e) {
          return { content: row.content, similarity: 0 };
        }
        const similarity = this.cosineSimilarity(queryEmbedding, embeddingArray);
        return { content: row.content, similarity };
      });

      // Sort by similarity and return top matches above a threshold
      return results
        .filter(res => res.similarity > 0.15)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (err) {
      console.error("Vector search failed:", err);
      return [];
    }
  }
}

module.exports = VectorMemory;
