const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');

const projectRoot = path.join(__dirname, '../..');
const axios = require('axios');

// POST endpoint for Speech-To-Text (Whisper.cpp local / Web API fallback)
router.post('/stt', async (req, res) => {
  const { audio } = req.body; // base64 encoded audio bytes

  if (!audio) {
    return res.status(400).json({ error: "Missing audio base64 in request." });
  }

  const recordingPath = '/tmp/recording.wav';
  const txtPath = '/tmp/recording.wav.txt';

  try {
    // Save base64 string to WAV file
    fs.writeFileSync(recordingPath, Buffer.from(audio, 'base64'));

    // Path to Whisper.cpp executable
    const whisperPath = process.env.WHISPER_PATH 
      ? (path.isAbsolute(process.env.WHISPER_PATH) ? process.env.WHISPER_PATH : path.join(projectRoot, process.env.WHISPER_PATH))
      : path.join(projectRoot, 'whisper.cpp/main');
    const modelPath = process.env.WHISPER_MODEL_PATH 
      ? (path.isAbsolute(process.env.WHISPER_MODEL_PATH) ? process.env.WHISPER_MODEL_PATH : path.join(projectRoot, process.env.WHISPER_MODEL_PATH))
      : path.join(projectRoot, 'models/ggml-base.en.bin');

    if (!fs.existsSync(whisperPath) || !fs.existsSync(modelPath)) {
      console.warn("Whisper.cpp executable or model not found. Instructing client to run Web Speech API fallback.");
      return res.json({ fallback: true, message: "Whisper.cpp not compiled or model missing." });
    }

    // Execute Whisper.cpp transcription (explicit 4 threads, quiet mode)
    const command = `"${whisperPath}" -m "${modelPath}" -f "${recordingPath}" -t 4 -np --output-txt`;
    
    const libPaths = [
      path.join(projectRoot, 'whisper-local/build/src'),
      path.join(projectRoot, 'whisper-local/build/ggml/src'),
      path.join(projectRoot, 'whisper.cpp/build/src'),
      path.join(projectRoot, 'whisper.cpp/build/ggml/src')
    ];
    if (process.env.LD_LIBRARY_PATH) {
      libPaths.push(process.env.LD_LIBRARY_PATH);
    }
    const whisperEnv = {
      ...process.env,
      LD_LIBRARY_PATH: libPaths.join(':')
    };

    exec(command, { env: whisperEnv }, (error, stdout, stderr) => {
      if (error) {
        console.error("Whisper transcription process failed:", stderr);
        return res.json({ fallback: true, error: error.message });
      }

      if (fs.existsSync(txtPath)) {
        const text = fs.readFileSync(txtPath, 'utf8').trim();
        // Clean up output files
        try {
          fs.unlinkSync(recordingPath);
          fs.unlinkSync(txtPath);
        } catch (e) {}

        res.json({ text, fallback: false });
      } else {
        res.json({ fallback: true, error: "Whisper text output file missing." });
      }
    });

  } catch (err) {
    console.error("STT endpoint error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST endpoint for Text-To-Speech
router.post('/tts', async (req, res) => {
  const { text, ttsProvider = 'edge-tts', voiceId = 'en-US-AvaNeural' } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing text in request." });
  }

  const ttsOutPath = '/tmp/tts_out.wav';
  const ttsInputPath = '/tmp/tts_input.txt';

  const runPiperFallback = (originalErrorMsg) => {
    try {
      const piperBin = process.env.PIPER_PATH 
        ? (path.isAbsolute(process.env.PIPER_PATH) ? process.env.PIPER_PATH : path.join(projectRoot, process.env.PIPER_PATH))
        : path.join(projectRoot, 'piper/piper');
      const piperModel = process.env.PIPER_MODEL_PATH 
        ? (path.isAbsolute(process.env.PIPER_MODEL_PATH) ? process.env.PIPER_MODEL_PATH : path.join(projectRoot, process.env.PIPER_MODEL_PATH))
        : path.join(projectRoot, 'models/en_US-lessac-medium.onnx');

      if (fs.existsSync(piperBin) && fs.existsSync(piperModel)) {
        console.log("Running local Piper fallback synthesis...");
        const command = `"${piperBin}" --model "${piperModel}" --output_file "${ttsOutPath}" < "${ttsInputPath}"`;
        execSync(command);
        return res.json({ audioUrl: '/tmp/tts_out.wav', fallback: false });
      }
    } catch (fallbackErr) {
      console.error("Local Piper fallback also failed:", fallbackErr.message);
    }
    res.json({ fallback: true, error: originalErrorMsg });
  };

  try {
    // 0. Clean action tags then naturalise text for spoken delivery
    const stripped = text
      .replace(/\*\*[^*]+\*\*/g, '')
      .replace(/\*[^*]+\*/g, '')
      .replace(/\([^)]+\)/g, '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // ── Speech Naturalizer ──────────────────────────────────────────────
    // Convert written-style punctuation/patterns into natural spoken pauses
    // so the TTS engine doesn't sound like it's "reading"
    const naturalize = (t) => t
      // Numbered lists → spoken ordinals with a comma pause
      .replace(/^\s*\d+\.\s+/gm, '')
      // "e.g." / "i.e." → spoken forms
      .replace(/\be\.g\.\s*/gi, 'for example, ')
      .replace(/\bi\.e\.\s*/gi, 'that is, ')
      .replace(/\betc\.\s*/gi, 'and so on. ')
      // Em-dashes → natural pause comma
      .replace(/\s*[\u2013\u2014]\s*/g, ', ')
      // Semicolons → comma pause (less formal)
      .replace(/;\s*/g, ', ')
      // Colons not followed by a time (12:30) → comma
      .replace(/(?<!\d):\s*(?!\d)/g, ', ')
      // Ellipsis → a single pause comma
      .replace(/\.{2,}/g, '... ')
      // Excessive exclamation → single
      .replace(/!{2,}/g, '!')
      // Question then exclamation → keep question mark (sounds more natural)
      .replace(/\?!+/g, '?')
      // Multiple commas from above replacements
      .replace(/,\s*,/g, ',')
      .replace(/,\s*\.\s*/g, '. ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();

    const cleanedText = naturalize(stripped);
    const finalSpeechText = cleanedText || '...';

    console.log(`TTS synthesis requested. Provider: ${ttsProvider}, Voice: ${voiceId}`);
    console.log(`Naturalized speech: "${finalSpeechText}"`);
    
    // Clean old output file
    if (fs.existsSync(ttsOutPath)) {
      try { fs.unlinkSync(ttsOutPath); } catch (e) {}
    }
    if (fs.existsSync(ttsInputPath)) {
      try { fs.unlinkSync(ttsInputPath); } catch (e) {}
    }

    // Write input text to a temporary file for secure command execution
    fs.writeFileSync(ttsInputPath, finalSpeechText, 'utf8');

    // 1. ElevenLabs cloud TTS
    if (ttsProvider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) throw new Error("ElevenLabs API Key not configured.");
      
      const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        text: finalSpeechText,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      }, {
        headers: { 'xi-api-key': apiKey, 'accept': 'audio/mpeg' },
        responseType: 'arraybuffer'
      });
      
      fs.writeFileSync(ttsOutPath, response.data);
      return res.json({ audioUrl: '/tmp/tts_out.wav', fallback: false });
    }

    // 2. VoiceVox Local TTS (at http://localhost:50021)
    if (ttsProvider === 'voicevox') {
      const host = process.env.VOICEVOX_HOST || 'http://localhost:50021';
      // Create audio query
      const queryResponse = await axios.post(`${host}/audio_query?text=${encodeURIComponent(finalSpeechText)}&speaker=${voiceId}`, {}, { timeout: 3000 });
      // Synthesize
      const synthResponse = await axios.post(`${host}/synthesis?speaker=${voiceId}`, queryResponse.data, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 4000
      });
      
      fs.writeFileSync(ttsOutPath, synthResponse.data);
      return res.json({ audioUrl: '/tmp/tts_out.wav', fallback: false });
    }

    // 3. Kokoro Local/Cloud TTS (at localhost:8888 or custom Python server)
    if (ttsProvider === 'kokoro') {
      const host = process.env.KOKORO_HOST || 'http://localhost:8888';
      const response = await axios.post(`${host}/v1/audio/speech`, {
        input: finalSpeechText,
        voice: voiceId || 'af_bella',
        response_format: 'wav'
      }, {
        responseType: 'arraybuffer',
        timeout: 4000
      });
      
      fs.writeFileSync(ttsOutPath, response.data);
      return res.json({ audioUrl: '/tmp/tts_out.wav', fallback: false });
    }

    // 4. Piper Local TTS
    if (ttsProvider === 'piper') {
      const piperBin = process.env.PIPER_PATH 
        ? (path.isAbsolute(process.env.PIPER_PATH) ? process.env.PIPER_PATH : path.join(projectRoot, process.env.PIPER_PATH))
        : path.join(projectRoot, 'piper/piper');
      const piperModel = process.env.PIPER_MODEL_PATH 
        ? (path.isAbsolute(process.env.PIPER_MODEL_PATH) ? process.env.PIPER_MODEL_PATH : path.join(projectRoot, process.env.PIPER_MODEL_PATH))
        : path.join(projectRoot, 'models/en_US-lessac-medium.onnx');

      if (!fs.existsSync(piperBin) || !fs.existsSync(piperModel)) {
        throw new Error("Piper TTS binary or voice model not found.");
      }

      // Read securely from file redirection to prevent shell escaping/syntax issues
      const command = `"${piperBin}" --model "${piperModel}" --output_file "${ttsOutPath}" < "${ttsInputPath}"`;
      
      return exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("Piper TTS synthesis failed:", stderr);
          return res.status(500).json({ error: "Piper TTS process failed." });
        }
        res.json({ audioUrl: '/tmp/tts_out.wav', fallback: false });
      });
    }

    // 5. Default Fallback: Edge-TTS (Python subprocess)
    const edgeBin = fs.existsSync('/home/nanu/.local/bin/edge-tts') ? '/home/nanu/.local/bin/edge-tts' : 'edge-tts';
    // --rate: slightly faster delivery feels more lively and less robotic
    // --pitch: a small upward pitch shift makes the voice warmer and more expressive
    const edgeCommand = `"${edgeBin}" --voice "${voiceId}" --rate "+8%" --pitch "+5Hz" --file "${ttsInputPath}" --write-media "${ttsOutPath}"`;
    exec(edgeCommand, (error, stdout, stderr) => {
      if (error) {
        console.warn("Edge-TTS execution failed. Attempting local Piper fallback...", stderr);
        return runPiperFallback(error.message);
      }
      res.json({ audioUrl: '/tmp/tts_out.wav', fallback: false });
    });

  } catch (err) {
    console.warn(`TTS provider "${ttsProvider}" failed: ${err.message}. Attempting backend local Piper fallback...`);
    return runPiperFallback(err.message);
  }
});

module.exports = router;
