#!/bin/bash
set -e

echo "============================================="
echo "   Aria AI Companion Dependency Installer    "
echo "============================================="

# 1. System Requirements Diagnostics
echo "Checking system requirements..."
commands=(node npm python3 pip ffmpeg sox xdotool)
for cmd in "${commands[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "WARNING: '$cmd' is not installed. Please install it for full features (e.g., sudo apt install $cmd)."
    else
        echo " - $cmd: Found"
    fi
done

# 2. Node modules install
echo "Installing Node.js dependencies..."
npm install

# 3. Pip dependencies (edge-tts fallback)
echo "Installing python fallback voice libraries..."
pip3 install edge-tts --quiet || pip install edge-tts --quiet || echo "Warning: pip installation of edge-tts failed. Using browser fallbacks."

# 4. Compile Whisper and Piper local modules
chmod +x ./scripts/setup-whisper.sh
chmod +x ./scripts/setup-piper.sh

# Whisper compilation (can be slow, run if models folder doesn't have it)
if [ ! -f "./models/ggml-base.en.bin" ]; then
    read -p "Compile local Whisper.cpp Speech-To-Text? (y/n, defaults to y): " compile_whisper
    compile_whisper=${compile_whisper:-y}
    if [ "$compile_whisper" = "y" ] || [ "$compile_whisper" = "Y" ]; then
        ./scripts/setup-whisper.sh || echo "Whisper setup skipped or failed. Falling back to browser SpeechRecognition."
      fi
fi

# Piper setup
if [ ! -f "./models/en_US-lessac-medium.onnx" ]; then
    read -p "Install local Piper Text-To-Speech binary and models? (y/n, defaults to y): " compile_piper
    compile_piper=${compile_piper:-y}
    if [ "$compile_piper" = "y" ] || [ "$compile_piper" = "Y" ]; then
        ./scripts/setup-piper.sh || echo "Piper setup skipped or failed. Falling back to Edge-TTS."
    fi
fi

echo "============================================="
echo "   Installation completed successfully!      "
echo "============================================="
echo "To run the application in development mode:"
echo "  1. Copy .env.example to .env and input your Gemini/Groq keys."
echo "  2. Run: npm run dev"
echo "============================================="
