#!/usr/bin/env bash
set -e

# entrypoint.sh - render nginx template and start gateway
#
# Usage:
#   /entrypoint.sh

# write snippet files directly into /etc/nginx
[ -f /etc/nginx/proxy_defaults.conf ] || cat > /etc/nginx/proxy_defaults.conf <<'EOF'
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $http_connection;
proxy_set_header Host $host;
proxy_cache_bypass $http_upgrade;
EOF

[ -f /etc/nginx/proxy_ws.conf ] || cat > /etc/nginx/proxy_ws.conf <<'EOF'
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "Upgrade";
proxy_set_header Host $host;
EOF

[ -f /etc/nginx/proxy_nobuf.conf ] || cat > /etc/nginx/proxy_nobuf.conf <<'EOF'
proxy_pass_request_headers on;
proxy_buffering off;
proxy_cache off;
EOF

# derive upstream host/port with sane defaults
UPSTREAM="${UPSTREAM:-api-gateway:8080}"
UPSTREAM_HOST="${UPSTREAM_HOST:-${HOST:-${UPSTREAM%%:*}}}"
UPSTREAM_PORT="${UPSTREAM_PORT:-${PORT:-${UPSTREAM##*:}}}"
export UPSTREAM_HOST UPSTREAM_PORT

# render the template into the real nginx.conf
envsubst '${UPSTREAM_HOST} ${UPSTREAM_PORT}' \
  < /etc/nginx/templates/gw.tmpl > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'

