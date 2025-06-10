# Base image with Python 3.10 (compatible with Whisper + PyTorch)
FROM python:3.10-slim

# Set environment variables to prevent interactive prompts and buffer logs
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

# System dependencies: ffmpeg for audio handling, git for Whisper and other builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Whisper and dependencies
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir openai-whisper

# Optional: If you're running on CPU only and want to ensure no GPU is expected
ENV PYTORCH_ENABLE_MPS_FALLBACK=1