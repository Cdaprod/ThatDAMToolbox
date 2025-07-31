#!/usr/bin/env bash
# ----------------------------------------------
# ThatDAMToolbox Hot-Spot / mDNS / Web stack
# ----------------------------------------------
set -euo pipefail

# ──────────────────────────────────────────────
# 0) Token-gate the script
#    • the image was built with   --build-arg EPHEMERAL_TOKEN_SHA=<sha256>
#    • at run-time a secret is mounted (or env provided)
# ──────────────────────────────────────────────
readonly EXPECTED_SHA="${EPHEMERAL_TOKEN_SHA:?missing hash baked at build-time}"

# ① find the token (env var wins, then mounted secret)
TOKEN=""
if [[ -n "${SETUP_TOKEN:-}" ]];         then TOKEN="$SETUP_TOKEN"
elif [[ -n "${SETUP_TOKEN_FILE:-}" ]] \
     && [[ -f  "$SETUP_TOKEN_FILE" ]];  then TOKEN="$(<"$SETUP_TOKEN_FILE")"
else
  echo -e "\e[31m[error]\e[0m No SETUP_TOKEN or SETUP_TOKEN_FILE provided." >&2
  echo    "Hint: docker run … -e SETUP_TOKEN=\$(cat secrets/dam_token.txt)" >&2
  exit 1
fi

# ② verify SHA
CALC_SHA="$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)"
if [[ "$CALC_SHA" != "$EXPECTED_SHA" ]]; then
  echo -e "\e[31m[error]\e[0m Invalid token." >&2
  exit 1
fi

# ──────────────────────────────────────────────
# 1) Dry-run vs apply
# ──────────────────────────────────────────────
APPLY=0; [[ "${1:-}" == "apply" ]] && APPLY=1

msg() { echo -e "\e[1;32m[setup]\e[0m $*"; }

show_diff() {
  local path="$1" tmp="$2"
  if [[ -f "$path" ]]; then
    diff -u "$path" "$tmp" || true
  else
    msg "new file $path →"
    cat "$tmp"
  fi
}

write_config() {
  local path="$1"; shift
  local tmp;  tmp="$(mktemp)"
  cat >"$tmp" <<<"$*"
  if [[ "$APPLY" -eq 1 ]]; then
    sudo tee "$path" <"$tmp" >/dev/null
  else
    show_diff "$path" "$tmp"
  fi
  rm -f "$tmp"
}

network_snapshot() { inxi -n || ip -br addr; }

# ──────────────────────────────────────────────
# 2) Show BEFORE state
# ──────────────────────────────────────────────
msg "Network BEFORE:";   network_snapshot;   echo

# ──────────────────────────────────────────────
# 3) Nginx, Avahi, dnsmasq, hostapd configs
# ──────────────────────────────────────────────
write_config /etc/nginx/sites-available/thatdam <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name thatdamtoolbox.local _;

    root /var/www/html;
    index index.html;

    # Static Next.js export
    location / {
        try_files $uri $uri.html $uri/ =404;
    }

    # Assets
    location /_next/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy to API if you later expose it on 8080
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
    }

    # WebSocket passthrough
    location /ws/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
NGINX

write_config /etc/avahi/services/thatdam.service <<'AVAHI'
<?xml version="1.0" standalone='no'?><!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">ThatDAMToolbox on %h</name>
  <service><type>_http._tcp</type><port>80</port></service>
  <service><type>_thatdam._tcp</type><port>8080</port></service>
</service-group>
AVAHI

write_config /etc/dnsmasq.d/thatdam.conf <<'DNSMASQ'
interface=wlan0
bind-interfaces
dhcp-range=192.168.42.10,192.168.42.50,12h
address=/thatdamtoolbox.local/192.168.42.1
address=/*.local/192.168.42.1
DNSMASQ

write_config /etc/hostapd/hostapd.conf <<'HOSTAPD'
interface=wlan0
ssid=ThatDAMToolbox
hw_mode=g
channel=6
wpa=2
wpa_passphrase=thatdam123
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
wmm_enabled=1
auth_algs=1
HOSTAPD

# ──────────────────────────────────────────────
# 4) Startup helper
# ──────────────────────────────────────────────
write_config /usr/local/bin/start-services.sh <<'START'
#!/usr/bin/env bash
set -e

nginx -t && nginx

# Static hotspot IP
ip link set wlan0 up
ip addr add 192.168.42.1/24 dev wlan0

# Launch services
systemctl start avahi-daemon
systemctl start hostapd
systemctl start dnsmasq

echo "✓ Nginx @ http://thatdamtoolbox.local"
echo "✓ WiFi  SSID: ThatDAMToolbox  (pass: thatdam123)"
tail -F /var/log/nginx/access.log /var/log/nginx/error.log
START

chmod 755 /usr/local/bin/start-services.sh

# ──────────────────────────────────────────────
# 5) Copy token to host (only when APPLY)
# ──────────────────────────────────────────────
if [[ "$APPLY" -eq 1 ]]; then
    mkdir -p /etc/thatdamtoolbox
    printf '%s\n' "$TOKEN" > /etc/thatdamtoolbox/license.ephemeral
    chmod 600 /etc/thatdamtoolbox/license.ephemeral
fi

# ──────────────────────────────────────────────
# 6) DRY-RUN confirmation
# ──────────────────────────────────────────────
if [[ "$APPLY" -eq 0 ]]; then
  echo
  msg "The above is a preview (dry-run)."
  read -rp $'\e[33mApply these changes? [y/N] \e[0m' ans
  [[ "${ans,,}" == y ]] || { msg "aborted – nothing written"; exit 0; }
  exec "$0" apply   # re-exec in apply mode
fi

# ──────────────────────────────────────────────
# 7) Enable services & DONE
# ──────────────────────────────────────────────
ln -sf /etc/nginx/sites-available/thatdam /etc/nginx/sites-enabled/default
sed -i 's|#DAEMON_CONF=""|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd
systemctl enable nginx avahi-daemon hostapd dnsmasq

msg "Network AFTER:";  network_snapshot
msg "ThatDAMToolbox hotspot configured ✅"
msg "Run  /usr/local/bin/start-services.sh  to launch everything."