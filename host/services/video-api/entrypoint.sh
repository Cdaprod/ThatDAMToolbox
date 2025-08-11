#!/usr/bin/env bash
# entrypoint.sh - Video API entry with discovery role support
# Example: /entrypoint.sh
set -Eeuo pipefail
. /opt/shared/entrypoint-snippet.sh

if [ "$ROLE" = "server" ]; then
  exec /thatdamtoolbox/entrypoint.sh "$@"
else
  export EVENT_BROKER_URL="${EVENT_BROKER_URL:-amqp://video:video@${UPSTREAM_HOST}:${UPSTREAM_PORT:-5672}/}"
  exec /thatdamtoolbox/entrypoint.sh "$@" --upstream "http://${UPSTREAM_HOST}:${UPSTREAM_PORT:-8080}"
fi
