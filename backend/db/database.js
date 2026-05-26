const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Path to SQLite DB: ~/.config/vtuber-companion/memory.db
const dbDir = path.join(os.homedir(), '.config', 'vtuber-companion');
const dbPath = path.join(dbDir, 'memory.db');

// Ensure database directory exists
fs.mkdirSync(dbDir, { recursive: true });

// Initialize connection
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // optimize for fast concurrency

// Run migrations/init schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  // Check if characters table already exists and needs migration before running schema.sql
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='characters'").get();
  if (tableExists) {
    const columnInfo = db.prepare('PRAGMA table_info(characters)').all();
    const hasDefaultFlag = columnInfo.some(col => col.name === 'is_default');
    if (!hasDefaultFlag) {
      db.exec('ALTER TABLE characters ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
    }
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Ensure exactly one default character exists.
  const currentDefault = db.prepare('SELECT id FROM characters WHERE is_default = 1 ORDER BY id ASC LIMIT 1').get();
  if (!currentDefault) {
    const firstCharacter = db.prepare('SELECT id FROM characters ORDER BY id ASC LIMIT 1').get();
    if (firstCharacter) {
      db.prepare('UPDATE characters SET is_default = 1 WHERE id = ?').run(firstCharacter.id);
    }
  } else {
    const duplicate = db.prepare('SELECT id FROM characters WHERE is_default = 1 AND id != ? ORDER BY id ASC LIMIT 1').get(currentDefault.id);
    if (duplicate) {
      db.prepare('UPDATE characters SET is_default = 0 WHERE id != ?').run(currentDefault.id);
    }
  }
} else {
  console.warn("Database schema.sql not found at", schemaPath);
}

module.exports = db;
