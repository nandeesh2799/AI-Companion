const db = require('./database.js');

class MemoryManager {
  // Store a single message log in SQLite
  static addMessage(characterId, role, content, emotion = 'idle') {
    try {
      const stmt = db.prepare('INSERT INTO conversations (character_id, role, content, emotion) VALUES (?, ?, ?, ?)');
      stmt.run(characterId, role, content, emotion);
      
      // Auto-prune logs to keep active db queries clean (optional, keeping up to 200 logs for analytics but only loading 50)
      this.pruneOldMessages(characterId, 200);
    } catch (err) {
      console.error("Failed to add message to database:", err);
    }
  }

  // Retrieve last 50 messages to construct prompt history
  static getHistory(characterId, limit = 50) {
    try {
      const stmt = db.prepare('SELECT role, content, emotion, timestamp FROM conversations WHERE character_id = ? ORDER BY id DESC LIMIT ?');
      const rows = stmt.all(characterId, limit);
      // Reverse to chronological order (oldest first)
      return rows.reverse();
    } catch (err) {
      console.error("Failed to get chat history:", err);
      return [];
    }
  }

  // Prune conversations beyond a threshold to conserve local storage
  static pruneOldMessages(characterId, keepLimit = 200) {
    try {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM conversations WHERE character_id = ?');
      const res = countStmt.get(characterId);
      if (res && res.count > keepLimit) {
        const deleteStmt = db.prepare(`
          DELETE FROM conversations 
          WHERE id IN (
            SELECT id FROM conversations 
            WHERE character_id = ? 
            ORDER BY id ASC 
            LIMIT ?
          )
        `);
        deleteStmt.run(characterId, res.count - keepLimit);
      }
    } catch (err) {
      console.error("Pruning database failed:", err);
    }
  }

  // Generate rolling summary of the conversation
  static async generateRollingSummary(characterId, router, config) {
    try {
      const history = this.getHistory(characterId, 15);
      if (history.length < 10) return ""; // Not enough messages yet
      
      const historyText = history.map(h => `${h.role}: ${h.content}`).join('\n');
      const summaryPrompt = `Summarize this conversation briefly in 2 sentences, capturing key user details and topics discussed:\n\n${historyText}`;
      
      // Call AI router directly to get a summary
      const summaryResult = await router.generateResponse({
        message: summaryPrompt,
        systemPrompt: "You are a concise text summarizer. Write exactly 2 sentences summarizing the exchange.",
        history: [],
        config: config
      });

      return summaryResult.text || "";
    } catch (err) {
      console.error("Failed to generate rolling summary:", err);
      return "";
    }
  }
}

module.exports = MemoryManager;
