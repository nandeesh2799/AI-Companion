const express = require('express');
const router = express.Router();
const db = require('../db/database.js');
const MemoryManager = require('../db/MemoryManager.js');
const VectorMemory = require('../db/VectorMemory.js');
const AIRouter = require('../ai/AIRouter.js');
const VisionManager = require('../system/VisionManager.js');

const VALID_EMOTIONS = ['idle', 'happy', 'angry', 'embarrassed', 'excited', 'sleepy', 'smug', 'shocked', 'thinking'];
const EMOTION_ALIASES = {
  joy: 'happy',
  joyful: 'happy',
  cheerful: 'happy',
  delighted: 'happy',
  grateful: 'happy',
  mad: 'angry',
  annoyed: 'angry',
  frustrating: 'angry',
  frustrated: 'angry',
  rage: 'angry',
  blushing: 'embarrassed',
  blush: 'embarrassed',
  flustered: 'embarrassed',
  shy: 'embarrassed',
  energetic: 'excited',
  enthusiastic: 'excited',
  hyped: 'excited',
  surprise: 'shocked',
  surprised: 'shocked',
  startled: 'shocked',
  confused: 'thinking',
  curious: 'thinking',
  pondering: 'thinking',
  neutral: 'idle',
  calm: 'idle'
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeEmotion(rawEmotion = 'idle') {
  const normalized = String(rawEmotion).toLowerCase().trim().replace(/[^a-z]/g, '');
  if (VALID_EMOTIONS.includes(normalized)) return normalized;
  if (EMOTION_ALIASES[normalized]) return EMOTION_ALIASES[normalized];
  return 'idle';
}

function deriveEmotionIntensity(userInput = '', aiOutput = '', emotion = 'idle') {
  const text = `${userInput} ${aiOutput}`;
  const exclamations = (text.match(/!/g) || []).length;
  const questions = (text.match(/\?/g) || []).length;
  const ellipsis = (text.match(/\.\.\.|…/g) || []).length;
  const allCapsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;

  const baseByEmotion = {
    angry: 1.08,
    excited: 1.12,
    shocked: 1.15,
    happy: 0.96,
    embarrassed: 0.9,
    smug: 0.92,
    thinking: 0.86,
    sleepy: 0.72,
    idle: 0.65
  };

  let score = baseByEmotion[emotion] || 0.8;
  score += Math.min(exclamations, 6) * 0.06;
  score += Math.min(questions, 4) * 0.04;
  score += Math.min(allCapsWords, 3) * 0.05;

  if (emotion === 'thinking') {
    score += Math.min(questions, 3) * 0.06;
    score += Math.min(ellipsis, 2) * 0.05;
  }

  if (emotion === 'sleepy') {
    score -= 0.12;
  }

  return Number(clamp(score, 0.55, 1.6).toFixed(2));
}

// Scan text for fallback emotion trigger keywords if no tag was appended
function scanFallbackEmotion(userInput, aiOutput) {
  const text = (userInput + " " + aiOutput).toLowerCase();
  
  if (text.includes("love you") || text.includes("cute") || text.includes("beautiful") || text.includes("marry")) {
    return "embarrassed";
  }
  if (text.includes("idiot") || text.includes("stupid") || text.includes("useless") || text.includes("trash") || text.includes("damn") || text.includes("wtf")) {
    return "angry";
  }
  if (text.includes("thank you") || text.includes("great job") || text.includes("thanks") || text.includes("awesome") || text.includes("nice")) {
    return "happy";
  }
  if (text.includes("boring") || text.includes("whatever") || text.includes("meh")) {
    return "smug";
  }
  if (text.includes("dance") || text.includes("sing") || text.includes("celebrate") || text.includes("let's go") || text.includes("lets go") || text.includes("woo") || text.includes("hype")) {
    return "excited";
  }
  if (text.includes("tired") || text.includes("sleepy") || text.includes("bed") || text.includes("yawn")) {
    return "sleepy";
  }
  if (text.includes("what?!") || text.includes("seriously?") || text.includes("shocked") || text.includes("surprised")) {
    return "shocked";
  }
  if (text.includes("help") || text.includes("explain") || text.includes("why") || text.includes("how")) {
    return "thinking";
  }
  return "idle";
}

// POST endpoint for Chat exchanges
router.post('/', async (req, res) => {
  const { characterId, message, enableVision = false, currentWindow = "" } = req.body;

  if (!characterId || !message) {
    return res.status(400).json({ error: "Missing characterId or message in payload." });
  }

  try {
    // 1. Fetch character config
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    if (!character) {
      return res.status(404).json({ error: "Character profile not found." });
    }

    // 2. Fetch history
    const history = MemoryManager.getHistory(characterId, 10); // pull last 10 messages for context

    // 3. Search vector memories
    const semanticMemories = await VectorMemory.findSimilarMemories(characterId, message, 3, character);
    const memoryContext = semanticMemories.length > 0
      ? `\nRELEVANT PAST MEMORIES:\n${semanticMemories.map(m => `- ${m.content}`).join('\n')}`
      : "";

    // 4. Capture screenshot if vision mode is enabled
    let imageBase64 = null;
    if (enableVision) {
      try {
        console.log("Vision Mode Enabled: Capturing screenshot...");
        imageBase64 = await VisionManager.captureScreen();
      } catch (err) {
        console.warn("Screen capture failed for Vision Mode:", err.message);
      }
    }

    // 5. Gather desktop active window and time context
    const currentTimeStr = new Date().toLocaleTimeString();
    const systemContext = currentWindow 
      ? `\nUser's current active window: "${currentWindow}"`
      : "";

    // 6. Build the dynamic system prompt
    const fullSystemPrompt = `
${character.system_prompt}

CURRENT CONTEXT:
Time: ${currentTimeStr}
${systemContext}
${memoryContext}
`;

    // 7. Route request to AIRouter (Gemini -> Groq -> OpenRouter -> Ollama -> LMStudio)
    const result = await AIRouter.generateResponse({
      message,
      systemPrompt: fullSystemPrompt,
      history,
      imageBase64,
      config: character
    });

    // 8. Parse Response for [EMOTION:X] tags
    let cleanText = result.text;
    let emotion = 'idle';

    const emotionMatch = cleanText.match(/\[EMOTION:([^\]]+)\]/i);
    if (emotionMatch) {
      emotion = normalizeEmotion(emotionMatch[1]);
      // Remove tag from final visual text output
      cleanText = cleanText.replace(/\[EMOTION:[^\]]+\]/gi, '').trim();
    } else {
      // Fallback keyword scanning
      emotion = normalizeEmotion(scanFallbackEmotion(message, cleanText));
    }

    // Validate emotion exists in standard mappings
    if (!VALID_EMOTIONS.includes(emotion)) {
      emotion = 'idle';
    }

    const intensity = deriveEmotionIntensity(message, cleanText, emotion);

    // 9. Save exchanged messages to database
    MemoryManager.addMessage(characterId, 'user', message, 'idle');
    MemoryManager.addMessage(characterId, 'assistant', cleanText, emotion);
    
    // Add dialogue to Vector Memory chunks asynchronously for future semantic retrievals
    // Only embed relevant meaningful statements (longer than 10 characters)
    if (message.length > 10) {
      VectorMemory.addMemory(characterId, `User said: "${message}" -> Aria replied: "${cleanText}"`, character);
    }

    // Return payload to client
    res.json({
      text: cleanText,
      emotion: emotion,
      intensity,
      model: result.model,
      latencyMs: result.latencyMs
    });

  } catch (err) {
    console.error("Chat route failed:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
