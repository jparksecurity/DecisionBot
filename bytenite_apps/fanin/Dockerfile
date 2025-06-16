FROM debian:bookworm-slim AS builder

# ---- build llama.cpp with CPU optimisations ----
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential cmake git curl ca-certificates pkg-config libopenblas-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone --depth 1 https://github.com/ggerganov/llama.cpp
WORKDIR /opt/llama.cpp
# Build the standalone HTTP server variant (llama-server) using CMake
# Disable ARM optimizations to avoid NEON compatibility issues
RUN cmake -B build -DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS -DLLAMA_CURL=OFF -DGGML_NATIVE=OFF && \
    cmake --build build --config Release -j$(nproc)

# -------------------------------------------------
# Final image that ByteNite will actually run
# -------------------------------------------------
FROM python:3.12-slim AS runtime

# runtime dependency for the static llama-server binary
RUN apt-get update && apt-get install -y --no-install-recommends libopenblas0 curl && \
    rm -rf /var/lib/apt/lists/*

# Download Llama-4-Scout model during build (IQ2_XXS ~39GB - official Unsloth version)
# Using huggingface-cli to handle potential split files properly
RUN pip install huggingface_hub && \
    mkdir -p /models && \
    huggingface-cli download unsloth/Llama-4-Scout-17B-16E-Instruct-GGUF \
    --include "*IQ2_XXS*" \
    --local-dir /models/unsloth-scout

# Copy the compiled server binary (llama-server is the correct name)
COPY --from=builder /opt/llama.cpp/build/bin/llama-server /usr/local/bin/llama-server

# Copy the assembler application
COPY app /workspace/app
WORKDIR /workspace/app

# Copy launch helper
COPY run.sh /run.sh
RUN chmod +x /run.sh

# If you later add Python deps put them here, e.g.
# RUN pip install -r requirements.txt

ENV PYTHONUNBUFFERED=1

# expose OpenAI-compatible port inside the container
EXPOSE 8000

ENTRYPOINT ["/run.sh"] 