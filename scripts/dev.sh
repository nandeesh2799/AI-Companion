#!/bin/bash

# Port cleanup function to ensure clean launches
cleanup() {
    echo "Shutting down companion servers..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "Starting Express backend..."
NODE_ENV=development node backend/server.js &

echo "Starting Vite dev server..."
npx vite &

echo "Waiting for dev servers to initialize..."
sleep 3

echo "Launching Electron window..."
npx electron .
