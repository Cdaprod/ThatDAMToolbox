#!/usr/bin/env bash
# entrypoint.sh - Camera proxy startup with discovery
# Example: /entrypoint.sh
set -Eeuo pipefail
. /opt/shared/entrypoint-snippet.sh

: "${UPSTREAM_HOST:?leader missing}"; : "${UPSTREAM_PORT:?leader missing}"
exec /usr/local/bin/camera-proxy --server "http://${UPSTREAM_HOST}:${UPSTREAM_PORT}"
