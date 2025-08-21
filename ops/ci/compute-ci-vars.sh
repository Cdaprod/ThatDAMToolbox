#!/usr/bin/env bash
# compute-ci-vars.sh - derive VERSION and CHANNEL for CI
# Usage: bash ops/ci/compute-ci-vars.sh [env_file]
# Example: bash ops/ci/compute-ci-vars.sh ops/ci/vars.env
set -euo pipefail

# Derive VERSION + CHANNEL for CI; write ENV_FILE
ENV_FILE="${1:-./ops/ci/vars.env}"

REGISTRY="${REGISTRY:-ghcr.io}"
REGISTRY_NS="${REGISTRY_NS:-cdaprod}"
SERVICE_EDGE="${SERVICE_EDGE:-thatdam-run}"

ref_type="${GITHUB_REF_TYPE:-${GITHUB_REF_TYPE:-}}"
ref_name="${GITHUB_REF_NAME:-${GITHUB_REF_NAME:-}}"
sha="${GITHUB_SHA:-$(git rev-parse --short=12 HEAD)}"

if [[ "${ref_type}" == "tag" && "${ref_name}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  CHANNEL="prod"
  VERSION="${ref_name#v}"
elif [[ "${ref_name}" == "staging" ]]; then
  CHANNEL="staging"
  VERSION="$(date -u +%Y.%m.%d)-${sha}"
else
  CHANNEL="dev"
  VERSION="$(date -u +%Y.%m.%d)-${sha}"
fi

cat > "${ENV_FILE}" <<EOFV
REGISTRY=${REGISTRY}
REGISTRY_NS=${REGISTRY_NS}
SERVICE_EDGE=${SERVICE_EDGE}
VERSION=${VERSION}
CHANNEL=${CHANNEL}
TARGET_PLATFORMS=linux/amd64,linux/arm64
IMAGE_SUFFIX=
GIT_SHA=${sha}
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOFV

echo "Wrote ${ENV_FILE}"
cat "${ENV_FILE}"
