#!/usr/bin/env bash
# entrypoint.sh - Camera proxy startup with discovery
# Example: /entrypoint.sh
set -Eeuo pipefail
. /opt/shared/entrypoint-snippet.sh

# Only require upstream when acting as an agent
if [ "${ROLE:-server}" = "agent" ]; then
  : "${UPSTREAM_HOST:?leader missing}"
  : "${UPSTREAM_PORT:?leader missing}"
fi
exec /usr/local/bin/camera-proxy --server "http://${UPSTREAM_HOST}:${UPSTREAM_PORT}"
