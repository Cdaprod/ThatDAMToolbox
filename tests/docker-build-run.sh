#!/usr/bin/env bash
set -e

IMG=cdaprod/video
TAG=${1:-dev}

echo "🔨 Building $IMG:$TAG (native arch)…"
docker build -t $IMG:$TAG .

echo "🚀 Running container (port 8080)…"
docker run --rm -p 8080:8080 $IMG:$TAG