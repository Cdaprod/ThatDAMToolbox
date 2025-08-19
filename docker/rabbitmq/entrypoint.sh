#!/usr/bin/env bash
set -euo pipefail

# entrypoint.sh - enable required RabbitMQ feature flag then start the server
#
# Usage:
#   /usr/local/bin/rabbitmq-entrypoint.sh [rabbitmq-server]
#
# Example:
#   docker compose run --rm rabbitmq /usr/local/bin/rabbitmq-entrypoint.sh rabbitmq-server
#
# Enables the classic_mirrored_queue_version feature flag if available before
# delegating to the default RabbitMQ entrypoint.

if command -v rabbitmqctl >/dev/null 2>&1; then
  rabbitmqctl enable_feature_flag classic_mirrored_queue_version >/proc/1/fd/1 2>/proc/1/fd/2 || true
else
  echo "rabbitmqctl not found; skipping feature flag enable" >&2
fi

exec docker-entrypoint.sh "$@"
