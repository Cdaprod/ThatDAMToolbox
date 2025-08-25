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
UPSTREAM="${UPSTREAM:-127.0.0.1:8080}"
UPSTREAM_HOST="${UPSTREAM_HOST:-${HOST:-${UPSTREAM%%:*}}}"
UPSTREAM_PORT="${UPSTREAM_PORT:-${PORT:-${UPSTREAM##*:}}}"

WEB_APP="${WEB_APP:-127.0.0.1:3000}"
WEB_APP_HOST="${WEB_APP_HOST:-${WEB_APP%%:*}}"
WEB_APP_PORT="${WEB_APP_PORT:-${WEB_APP##*:}}"

export UPSTREAM_HOST UPSTREAM_PORT WEB_APP_HOST WEB_APP_PORT

# fail fast if the upstream host cannot be resolved
if ! getent hosts "$UPSTREAM_HOST" >/dev/null; then
  echo "entrypoint: unable to resolve upstream host '$UPSTREAM_HOST'" >&2
  exit 1
fi
if ! getent hosts "$WEB_APP_HOST" >/dev/null; then
  echo "entrypoint: unable to resolve web app host '$WEB_APP_HOST'" >&2
  exit 1
fi

# render the template into the real nginx.conf
envsubst '${UPSTREAM_HOST} ${UPSTREAM_PORT} ${WEB_APP_HOST} ${WEB_APP_PORT}' \
  < /etc/nginx/templates/gw.tmpl > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'

