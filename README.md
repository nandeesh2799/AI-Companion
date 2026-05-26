# Aria: Desktop AI VTuber Companion

Aria is a production-ready, highly interactive desktop AI companion that lives on your Linux/Zorin OS screen as a transparent, always-on-top overlay. Aria features expressive 2D animations, real-time voice synthesis and recognition, visual screen context capabilities, and local privacy-first offline operation.

---

## ✨ Key Features

- 🧠 **Choose Your AI**: Run with cloud-powered models (Gemini Flash, Groq, OpenRouter) or local private models (Ollama, LMStudio) out of the box.
- 👁️ **Vision Mode**: Enable Aria to capture screenshots of your desktop screen to analyze and understand what you are working on.
- 🎭 **Animated Characters**: Modular rendering support for 2D Spritesheets (our generated Aria model), Live2D models (.model3.json), and 3D VRM characters.
- 🎤 **Natural Voices**: Expressive speech synthesis using ElevenLabs, Kokoro, VoiceVox, local Piper, or Edge-TTS fallbacks.
- 💾 **Vector Memory**: Local embeddings calculations stored in SQLite to query relevant semantic memories across past conversation exchanges.
- 🔒 **Privacy-First**: Run 100% locally by pairing Ollama (LLM/embeddings) + Whisper.cpp (STT) + Piper/VoiceVox (TTS). No internet connection required.
- 🎨 **Unlimited Characters**: Build custom personas, system prompts, default voices, and model routing parameters, and swap active profiles instantly.

---

## 🚀 Getting Started

### 1. Installation
Run the automated installer to check dependencies, install NPM modules, fetch fallback configurations, and compile local binaries:

```bash
chmod +x ./scripts/install.sh
./scripts/install.sh
```

### 2. Configuration (.env)
Copy the `.env.example` file to `.env` and fill in your preferred API keys:

```bash
cp .env.example .env
```

Parameters list:
- `GEMINI_API_KEY`: API key for Gemini Flash LLM & Embeddings.
- `GROQ_API_KEY`: API key for low-latency Groq models (Llama 3.1).
- `ELEVENLABS_API_KEY`: ElevenLabs TTS key.
- `OLLAMA_HOST`: Local Ollama API (default: `http://localhost:11434`).

### 3. Launch Development Server
Launch the Express API endpoints, Vite client server, and Electron shell:

```bash
npm run dev
```

---

## 🎮 Desktop Interactions & Controls

- 🖱️ **Repositioning (Dragging)**: Hover near the top edge of the avatar to reveal the grip dots handle, then hold and drag to reposition Aria anywhere on the screen.
- ⚙️ **Settings Panel (Switcher)**: Click the **Gear Icon** at the top right to open the switcher panel. Here you can change active profiles, add new characters, or toggle LLM and voice engines.
- 🎙️ **Push-To-Talk**: Press and hold the **Mic Button** (or hold down the Spacebar) to talk. Release to trigger transcription.
- 👁️ **Vision Toggle**: Click the **Eye Icon** to toggle Vision Mode. When active, Aria captures screen states when you speak.
- 📳 **Shaking Reaction**: Repositioning Aria too quickly or "shaking" her window rapidly triggers an angry response: *"It's not a physics test dummy! Fix your code without shaking!"*.
- ⌨️ **Global Toggle Shortcut**: Press `Ctrl+Shift+A` from anywhere on your OS to instantly show or hide the companion window.
