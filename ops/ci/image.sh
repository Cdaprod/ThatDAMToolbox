#!/usr/bin/env bash
# image.sh - helper utilities for image references and tagging
# Usage: bash ops/ci/image.sh [envfile] <command> <service>
# Example: bash ops/ci/image.sh ops/ci/vars.env image_ref thatdam-run
set -euo pipefail

envfile="${1:-}"
cmd="${2:-}"

if [[ -n "${envfile}" && -f "${envfile}" ]]; then
  set -a; . "${envfile}"; set +a
fi

: "${REGISTRY:?missing}"; : "${REGISTRY_NS:?missing}"
: "${VERSION:?missing}";  : "${CHANNEL:?missing}"

svc_ref() { # canonical immutable ref
  local svc="$1"
  local suf="${IMAGE_SUFFIX:-}"
  echo "${REGISTRY}/${REGISTRY_NS}/${svc}:${VERSION}${suf}"
}

svc_channel() { # mutable lane pointer
  local svc="$1"
  echo "${REGISTRY}/${REGISTRY_NS}/${svc}:${CHANNEL}"
}

svc_latest() { # dev-only convenience
  local svc="$1"
  echo "${REGISTRY}/${REGISTRY_NS}/${svc}:latest"
}

digest_of() { # prints digest for canonical ref
  local ref="$1"
  docker buildx imagetools inspect "$ref" | awk '/Digest:/ {print $2; exit}'
}

print_matrix() {
  cat <<EOFM
REGISTRY=${REGISTRY}
REGISTRY_NS=${REGISTRY_NS}
VERSION=${VERSION}
CHANNEL=${CHANNEL}
TARGET_PLATFORMS=${TARGET_PLATFORMS:-linux/amd64,linux/arm64}
IMAGE_SUFFIX=${IMAGE_SUFFIX:-}
EOFM
}

case "${cmd:-}" in
  image_ref)    svc_ref "$3";;
  channel_tag)  svc_channel "$3";;
  latest_tag)   svc_latest "$3";;
  digest)       digest_of "$3";;
  print_matrix) print_matrix;;
  *) :;;
 esac
