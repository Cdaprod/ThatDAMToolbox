#!/usr/bin/env bash
# entrypoint.sh - Gateway startup with discovery
# Example: /entrypoint.sh
set -Eeuo pipefail
. /opt/shared/entrypoint-snippet.sh

: "${NGINX_TEMPLATE:=/etc/nginx/templates/gw.tmpl}"
: "${NGINX_CONF:=/etc/nginx/nginx.conf}"

export API_HOST="${UPSTREAM_HOST:-127.0.0.1}"
export API_PORT="${UPSTREAM_PORT:-8080}"

envsubst < "$NGINX_TEMPLATE" > "$NGINX_CONF"
nginx -t
exec nginx -g 'daemon off;'
