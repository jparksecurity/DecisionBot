#!/usr/bin/env bash
# Build and push the custom ByteNite assembler image.
# Usage:  DOCKERHUB_USERNAME=<user> ./build_and_push.sh [tag]
set -euo pipefail

if [[ -z "${DOCKERHUB_USERNAME:-}" ]]; then
  echo "ERROR: please export DOCKERHUB_USERNAME first" >&2
  exit 1
fi

TAG=${1:-latest}
IMAGE_NAME="${DOCKERHUB_USERNAME}/scout17b-assembler:${TAG}"

# Build from the current directory (folder contains Dockerfile)

echo "[build] Building $IMAGE_NAME ..."
docker build -t "$IMAGE_NAME" .

echo "[push] Pushing $IMAGE_NAME ..."
docker push "$IMAGE_NAME"

echo "Done. Update manifest.json container field to: $IMAGE_NAME" 