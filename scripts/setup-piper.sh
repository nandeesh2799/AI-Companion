#!/bin/bash
set -e

echo "=== Setting up local Piper Text-To-Speech ==="

mkdir -p ./models
mkdir -p ./piper

# Download precompiled Piper CLI binary
if [ ! -f "./piper/piper" ]; then
    echo "Downloading Piper binary (v1.2.0)..."
    wget -q --show-progress -O /tmp/piper.tar.gz https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
    echo "Extracting Piper binary..."
    tar -xzf /tmp/piper.tar.gz -C ./piper --strip-components=1
    rm /tmp/piper.tar.gz
fi

# Download voice model files
echo "Downloading en_US-lessac-medium voice model..."
if [ ! -f "./models/en_US-lessac-medium.onnx" ]; then
    wget -q --show-progress -O ./models/en_US-lessac-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
fi

if [ ! -f "./models/en_US-lessac-medium.onnx.json" ]; then
    wget -q --show-progress -O ./models/en_US-lessac-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
fi

echo "Piper TTS installed successfully. Voice model ready in ./models/"
