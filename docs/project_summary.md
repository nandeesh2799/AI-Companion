# VTuber Companion — Project Summary & Features

VTuber Companion is an interactive desktop overlay application featuring **Aria**, a sarcastic, playful, and emotionally reactive anime assistant that floats on your desktop. The project is designed to run locally on Linux, combining speech interaction, real-time animation, system state awareness, and long-term memory.

---

## 1. Project Concept
The companion acts as an interactive desktop partner that:
- Floats transparently on top of all windows.
- Responds affectionately or sarcastically based on the context of your questions.
- Reacts to desktop movements (e.g. gets annoyed and dizzy if you shake her window).
- Monitors what you're working on (detects active window name) to tease you or comment on your workflow.
- Captures your desktop screen (Vision Mode) to look at your code, design, or websites and provide feedback.

---

## 2. Feature Checklist

### 🎤 Speech & Audio
- **Smart Voice Detection**: The mic stays open continuously (Auto-Mic mode). It calibrates itself to the room's background noise floor when opened, records your speech, and automatically stops once you are silent for 900ms.
- **Speech-To-Text (STT)**: Utilizes a local C++ compilation of Whisper (`whisper-cli` binary) and falls back to the browser's native Web Speech API if offline or uncompiled.
- **Text-To-Speech (TTS)**: Synthesizes voice outputs using Microsoft Edge Neural voices (via `edge-tts` python package) or fully local voice generation using `piper` (TTS engine). If both fail, it falls back to your browser's speech synthesis engine.
- **Viseme Lip-Syncing**: Translates the volume levels of playing speech audio in real-time to animate the avatar's mouth movements (`a`, `i`, `u`, `closed`).

### 🎨 Visual & Physics Engine
- **Transparent Desktop Widget**: Implemented as a frameless, transparent Electron overlay that supports clicking through transparent pixels.
- **Eye & Pupil Gaze Tracking**: The avatar's pupils follow your mouse cursor smoothly inside a set pixel radius.
- **Physics-driven Animations**: Simulates breathing (floating offset and scaling) and blinking.
- **Emotion Overrides**: The avatar morphs dynamically to display 9 distinct emotional states:
  - `idle`, `happy`, `angry`, `embarrassed`, `excited`, `sleepy`, `smug`, `shocked`, `thinking`.
- **Shake Detection**: Triggers an annoyed/angry visual response and customized dialog if the user physically shakes the companion window on the desktop.

### 🧠 Core Logic & Memory
- **Flexible LLM Adapter**: Dynamically routes prompts to Gemini, Groq, OpenRouter, Ollama, or LMStudio based on what keys are configured, falling back gracefully down the chain if an API quota is reached.
- **Semantic Long-Term Memory**: Automatically embeds exchanges and performs semantic search (cosine-similarity) on past chats to bring up relevant memories from previous conversations.
- **Desktop Window Monitoring**: Periodically polls the active window title (using `xdotool` or `xprop` on Linux) to customize conversational context.
- **Multimodal Desktop Vision**: If Vision Mode is enabled, the companion grabs a screenshot of your screen, sends it to the vision model, and describes what she sees.

---

## 3. Configuration & Profiles

The project stores user settings and characters inside a local SQLite database (`~/.config/vtuber-companion/memory.db`):
- **Custom Characters**: Create, update, switcher, or delete characters through the built-in React UI settings panel.
- **System Prompts**: System prompts enforce personality templates (e.g. Tsundere rules: use contractions, avoid long paragraphs, respond in 1-2 punchy sentences, output `[EMOTION:X]` tags).

---

## 4. Operational Commands & Shortcuts

- **Launch Command**: Run `npm run dev` from the project root. This spins up the Vite compiler, Express backend, and the Electron overlay.
- **Visibility Shortcut**: Press `Ctrl+Shift+A` at any point to show or hide the overlay window globally.
- **Drag Handle**: Drag the transparent overlay using the designated anchor handle next to the avatar.
- **Settings Toggle**: Click the gear settings overlay button to adjust characters, toggle Vision mode, or view audio levels.
- **Mute Toggle**: Click the microphone icon to suspend continuous listening.
