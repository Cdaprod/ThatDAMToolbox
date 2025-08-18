#!/bin/sh
# entrypoint-snippet.sh - shared logic for server/agent role detection
# Usage:
#   source /opt/shared/entrypoint-snippet.sh
# Example:
#   . /opt/shared/entrypoint-snippet.sh && echo "$ROLE"
set -eu

: "${LEADER_FILE:=/run/discovery/leader.env}"
: "${SERVICE_PORT:=8080}"
: "${ROLE:=auto}"
: "${UPSTREAM:=${API_GATEWAY_ADDR:-api-gateway:8080}}"

if [ -f "$LEADER_FILE" ]; then
  # shellcheck disable=SC1090
  . "$LEADER_FILE"
fi

if [ "$ROLE" = "auto" ]; then
  ROLE="agent"
  if [ -z "${UPSTREAM_HOST:-}" ] || [ -z "${UPSTREAM_PORT:-}" ]; then
    ROLE="server"
  else
    if ip -o -4 addr show | awk '{print $4}' | cut -d/ -f1 | grep -Fxq "${UPSTREAM_HOST:-notset}"; then
      ROLE="server"
    fi
    if [ "$UPSTREAM_HOST" = "$(hostname -f 2>/dev/null || hostname)" ]; then
      ROLE="server"
    fi
  fi
fi

export ROLE UPSTREAM UPSTREAM_HOST UPSTREAM_PORT SERVICE_PORT
echo "[entrypoint] ROLE=$ROLE UPSTREAM=${UPSTREAM:-} HOST=${UPSTREAM_HOST:-} PORT=${UPSTREAM_PORT:-} SERVICE_PORT=$SERVICE_PORT"

