#!/usr/bin/env bash
set -euo pipefail

# Make sure dirs exist
sudo install -d -o cdaprod -g cdaprod -m 0755 /opt/actions-runner/thatdam/bin
install -d -m 0755 /home/cdaprod/actions-work/thatdam
install -d -m 0755 /home/cdaprod/.cache

# Setup script
sudo tee /opt/actions-runner/thatdam/bin/setup.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

RUNNER_USER="cdaprod"
RUNNER_NAME="thatdam-ephemeral-01"
RUNNER_LABELS="repo=thatdam,arch=$(uname -m),role=ci,ephemeral"
RUNNER_ROOT="/opt/actions-runner/thatdam"
RUNNER_WORK="/home/${RUNNER_USER}/actions-work/thatdam"
REPO_URL="https://github.com/Cdaprod/ThatDAMToolbox"
RUNNER_VER="2.319.1"

# Expect export GITHUB_RUNNER_TOKEN before running

sudo install -d -o "${RUNNER_USER}" -g "${RUNNER_USER}" -m 0755 "${RUNNER_ROOT}"
install -d -m 0755 "${RUNNER_WORK}"
install -d -m 0755 "/home/${RUNNER_USER}/.cache"

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) PKG="actions-runner-linux-arm64-${RUNNER_VER}.tar.gz" ;;
  x86_64|amd64)  PKG="actions-runner-linux-x64-${RUNNER_VER}.tar.gz"   ;;
  *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;;
esac

curl -fsSLo "/tmp/${PKG}" "https://github.com/actions/runner/releases/download/v${RUNNER_VER}/${PKG}"
tar -xzf "/tmp/${PKG}" -C "${RUNNER_ROOT}"
rm -f "/tmp/${PKG}"

"${RUNNER_ROOT}/bin/installdependencies.sh" || true

if [ -z "${GITHUB_RUNNER_TOKEN:-}" ]; then
  echo "ERROR: export GITHUB_RUNNER_TOKEN first" >&2
  exit 1
fi

"${RUNNER_ROOT}/config.sh" remove --token "${GITHUB_RUNNER_TOKEN}" >/dev/null 2>&1 || true

"${RUNNER_ROOT}/config.sh" \
  --url "${REPO_URL}" \
  --token "${GITHUB_RUNNER_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --work "${RUNNER_WORK}" \
  --ephemeral \
  --unattended
EOF
sudo chmod +x /opt/actions-runner/thatdam/bin/setup.sh

# Loop script
sudo tee /opt/actions-runner/thatdam/bin/runner-loop.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/actions-runner/thatdam
while true; do
  ./run.sh || true
  sleep 2
done
EOF
sudo chmod +x /opt/actions-runner/thatdam/bin/runner-loop.sh

# Systemd unit
sudo tee /etc/systemd/system/github-runner-thatdam.service > /dev/null <<'EOF'
[Unit]
Description=GitHub Actions Runner (ThatDAM ephemeral)
After=network-online.target
Wants=network-online.target

[Service]
User=cdaprod
WorkingDirectory=/opt/actions-runner/thatdam
ExecStart=/opt/actions-runner/thatdam/bin/runner-loop.sh
Restart=always
RestartSec=2s

Environment=GOCACHE=/home/cdaprod/.cache/go-build
Environment=GOMODCACHE=/home/cdaprod/.cache/gomod
Environment=PIP_CACHE_DIR=/home/cdaprod/.cache/pip
Environment=npm_config_cache=/home/cdaprod/.cache/npm
Environment=YARN_CACHE_FOLDER=/home/cdaprod/.cache/yarn
Environment=UV_CACHE_DIR=/home/cdaprod/.cache/uv

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=false

[Install]
WantedBy=multi-user.target
EOF

# ---- RUN SETUP (needs token) BEFORE ENABLING SERVICE ----
# Prompt for token if not in env; preserves it for the setup call.
if [ -z "${GITHUB_RUNNER_TOKEN:-}" ]; then
  read -rsp "Paste GitHub runner registration token: " GITHUB_RUNNER_TOKEN; echo
fi

# Run setup as cdaprod; pass token via env
sudo -E -u cdaprod bash -lc 'GITHUB_RUNNER_TOKEN="$GITHUB_RUNNER_TOKEN" /opt/actions-runner/thatdam/bin/setup.sh'

# Reload + enable service
sudo systemctl daemon-reload
sudo systemctl enable --now github-runner-thatdam.service

echo "Runner installed and service started. Follow logs with:"
echo "  sudo journalctl -u github-runner-thatdam.service -f"