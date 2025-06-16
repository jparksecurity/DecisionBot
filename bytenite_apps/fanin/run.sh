#!/usr/bin/env bash
set -euo pipefail

# -------------------------
# Configuration via env vars
# -------------------------
# Find the IQ2_XXS model file (could be single file or split)
MODEL_DIR="/models/unsloth-scout"
MODEL_PATH=""

# Look for single file first
if [ -f "$MODEL_DIR"/*IQ2_XXS*.gguf ]; then
  MODEL_PATH=$(ls "$MODEL_DIR"/*IQ2_XXS*.gguf | head -1)
# Look for split files (first part)
elif [ -f "$MODEL_DIR"/*IQ2_XXS*-00001-of-*.gguf ]; then
  MODEL_PATH=$(ls "$MODEL_DIR"/*IQ2_XXS*-00001-of-*.gguf | head -1)
else
  echo "[run.sh] ERROR: No IQ2_XXS model file found in $MODEL_DIR" >&2
  echo "[run.sh] Available files:" >&2
  ls -la "$MODEL_DIR" || echo "Directory not found"
  exit 1
fi

PORT=${LLAMA_PORT:-8000}
THREADS=${THREADS:-$(nproc)}
CTX_SIZE=${CTX_SIZE:-4096}

echo "[run.sh] Using model: $MODEL_PATH"

# Start llama.cpp HTTP server in background with official Unsloth settings
llama-server \
  --model "$MODEL_PATH" \
  --port "$PORT" \
  --threads "$THREADS" \
  --ctx-size "$CTX_SIZE" \
  --temp 0.6 \
  --min-p 0.01 \
  --top-p 0.9 &
LLAMA_PID=$!

echo "[run.sh] llama-server started (pid $LLAMA_PID) with model $MODEL_PATH"
# Give it a moment to open the socket
sleep 5

# Run the ByteNite assembler logic
python3 main.py

# After main.py exits, shut down the LLM server cleanly
kill $LLAMA_PID || true 