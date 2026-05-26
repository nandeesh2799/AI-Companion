#!/bin/bash
set -e

echo "=== Setting up local Whisper.cpp Speech-To-Text ==="

# Create models directory
mkdir -p ./models

if [ ! -d "./whisper.cpp" ]; then
    echo "Cloning whisper.cpp repository..."
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git ./whisper.cpp
fi

echo "Compiling whisper.cpp..."
cd ./whisper.cpp
make -j$(nproc)

echo "Downloading ggml-base.en.bin model..."
if [ ! -f "./models/ggml-base.en.bin" ]; then
    bash ./models/download-ggml-model.sh base.en
fi

# Copy model to central models directory
cp ./models/ggml-base.en.bin ../models/
cd ..

echo "Whisper.cpp compiled successfully. Model installed at ./models/ggml-base.en.bin"
