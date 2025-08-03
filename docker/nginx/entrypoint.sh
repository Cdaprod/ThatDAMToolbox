#!/usr/bin/env bash
set -e

# write snippet files directly into /etc/nginx
cat >/etc/nginx/proxy_defaults.conf <<'EOF'
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $http_connection;
proxy_set_header Host $host;
proxy_cache_bypass $http_upgrade;
EOF

cat >/etc/nginx/proxy_ws.conf <<'EOF'
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "Upgrade";
proxy_set_header Host $host;
EOF

cat >/etc/nginx/proxy_nobuf.conf <<'EOF'
proxy_pass_request_headers on;
proxy_buffering off;
proxy_cache off;
EOF

# defaults for envsubst
: ${API_HOST:=video-api}
: ${API_PORT:=8080}
: ${WEB_HOST:=video-web}
: ${WEB_PORT:=3000}

# render the template into the real nginx.conf
envsubst '${API_HOST} ${API_PORT} ${WEB_HOST} ${WEB_PORT}' \
  < /etc/nginx/nginx.tmpl > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'