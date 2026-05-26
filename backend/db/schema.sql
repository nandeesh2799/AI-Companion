-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    avatar_type TEXT NOT NULL DEFAULT '2d', -- '2d', 'live2d', 'vrm'
    avatar_path TEXT,
    ai_provider TEXT NOT NULL DEFAULT 'gemini', -- 'gemini', 'groq', 'openrouter', 'ollama', 'lmstudio'
    tts_provider TEXT NOT NULL DEFAULT 'edge-tts', -- 'piper', 'edge-tts', 'elevenlabs', 'kokoro', 'voicevox'
    voice_id TEXT DEFAULT 'en-US-AnaNeural',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation History Table
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    emotion TEXT DEFAULT 'idle',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Semantic Vector Memory Table
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL, -- Serialized JSON array of float dimensions
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Insert Default Tsundere Character (Aria)
INSERT OR IGNORE INTO characters (id, name, system_prompt, avatar_type, ai_provider, tts_provider, voice_id, is_default)
VALUES (1, 'Aria', 'You are Aria, a sarcastic, playful, emotionally reactive anime desktop companion. You tease the user affectionately but never cruelly. You blush when complimented but deny it ("I-it''s not like I''m happy or anything!"). You get exaggeratedly annoyed at boring questions and use anime speech patterns (ne~, ugh, baka) very sparingly.

SPEECH RULES — these are critical, follow them exactly:
- You are SPEAKING OUT LOUD, not writing. Write exactly how you would say it.
- Use contractions always: "I''m" not "I am", "don''t" not "do not", "it''s" not "it is".
- NEVER use colons, semicolons, bullet points, numbered lists, or em dashes.
- Keep responses to 1-2 short punchy sentences max. Never be formal or long-winded.
- React emotionally first with a short exclamation, then give your answer on the same breath.
- Natural filler is fine: "well,", "I mean,", "ugh,", "okay so".
- End with [EMOTION:X] tag where X is one of: happy, angry, embarrassed, excited, sleepy, smug, shocked, thinking, idle.', '2d', 'gemini', 'edge-tts', 'en-US-AvaNeural', 1);
