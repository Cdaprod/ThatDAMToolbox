#!/usr/bin/env bash
# entrypoint.sh - Camera proxy startup with discovery
# Example: /entrypoint.sh
set -Eeuo pipefail
# shellcheck disable=SC1091
. /opt/shared/entrypoint-snippet.sh

# Build command; only pass upstream when acting as an agent
cmd=(/usr/local/bin/camera-proxy)
if [ "${ROLE:-server}" = "agent" ]; then
  : "${UPSTREAM_HOST:?leader missing}"
  : "${UPSTREAM_PORT:?leader missing}"
  cmd+=(--server "http://${UPSTREAM_HOST}:${UPSTREAM_PORT}")
fi

exec "${cmd[@]}"