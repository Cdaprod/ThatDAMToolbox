#!/bin/bash
# /scripts/build-push-multiarch.sh

# Usage: ./scripts/build-push-multiarch.sh <dockerhub-username/repo> <tag>
# Example: ./scripts/build-push-multiarch.sh cdaprod/video prod

set -euo pipefail

REPO="${1:-cdaprod/video}"              # default repo
TAG="${2:-dev}"                         # default tag

ARCHES="linux/amd64,linux/arm64"        # add more if needed

echo "==> Building and pushing $REPO:$TAG for [$ARCHES]"

# Ensure buildx is available
if ! docker buildx version >/dev/null 2>&1; then
  echo "Docker Buildx is required. Upgrade Docker to enable multi-arch builds."
  exit 1
fi

# Optional: Create a builder if not exists
if ! docker buildx inspect multiarch-builder >/dev/null 2>&1; then
  docker buildx create --name multiarch-builder --use
fi

# Optional: log in to Docker Hub (script will prompt if not already logged in)
echo "==> Logging in to Docker Hub"
docker login

# Build & push
docker buildx build \
  --platform "$ARCHES" \
  --tag "$REPO:$TAG" \
  --push \
  -f Dockerfile .

echo "==> Multi-arch image pushed as $REPO:$TAG"