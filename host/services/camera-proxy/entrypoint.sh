#!/bin/sh
# entrypoint.sh - Camera proxy startup with discovery
# Example: /entrypoint.sh
set -eu
# shellcheck disable=SC1091
. /opt/shared/entrypoint-snippet.sh

ROLE="${ROLE:-server}"
UPSTREAM="${UPSTREAM:-api-gateway:8080}"

# Derive host and port from UPSTREAM if specific vars are absent
UPSTREAM_HOST="${UPSTREAM_HOST:-${UPSTREAM%%:*}}"
UPSTREAM_PORT="${UPSTREAM_PORT:-${UPSTREAM##*:}}"

# Final defaults if still empty
: "${UPSTREAM_HOST:=api-gateway}"
: "${UPSTREAM_PORT:=8080}"

set -- /usr/local/bin/camera-proxy "$@"
if [ "$ROLE" = "agent" ]; then
  set -- "$@" --server "http://${UPSTREAM_HOST}:${UPSTREAM_PORT}"
fi

exec "$@"
