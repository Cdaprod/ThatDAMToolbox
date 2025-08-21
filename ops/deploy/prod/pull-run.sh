#!/usr/bin/env bash
# pull-run.sh - fetch and run edge image pinned by digest
# Usage:
#   DIGEST="ghcr.io/cdaprod/thatdam-run:1.4.0@sha256:..." ./ops/deploy/prod/pull-run.sh
#   TAG="v1.4.0" ./ops/deploy/prod/pull-run.sh  # requires gh CLI
# Example:
#   TAG=v1.4.0 TENANT_ID=demo ./ops/deploy/prod/pull-run.sh
# Exits non-zero on failure.
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io}"
REGISTRY_NS="${REGISTRY_NS:-cdaprod}"
SERVICE_EDGE="${SERVICE_EDGE:-thatdam-run}"

if [[ -z "${DIGEST:-}" ]]; then
  : "${TAG:?Set TAG (e.g., v1.4.0) or provide DIGEST explicitly}"
  DIGEST="$(gh release view "$TAG" --repo "${REGISTRY_NS}/ThatDAMToolbox" --json body -q '.body' | awk -F'Edge image: ' 'NF>1{print $2}' | awk '{print $1}')"
fi

if [[ -z "${DIGEST}" ]]; then
  echo "ERROR: Could not resolve image digest." >&2
  exit 1
fi

echo "Using image: ${DIGEST}"
docker pull "${DIGEST}"

NAME="${NAME:-thatdam-run}"
docker rm -f "$NAME" 2>/dev/null || true

docker run -d --name "$NAME" --restart unless-stopped \
  -e TENANT_ID="${TENANT_ID:-demo}" \
  -e CLOUD_API_BASE="${CLOUD_API_BASE:-https://api.example.tld}" \
  -e FEATURE_FLAGS="${FEATURE_FLAGS:-prod}" \
  -p 9999:9999 \
  "${DIGEST}"

docker ps --filter "name=$NAME"
