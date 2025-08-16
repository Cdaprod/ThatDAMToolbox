#!/usr/bin/env bash
# install-runner.sh installs and starts the runner via systemd.
# Example:
#   SUPERVISOR_URL=http://localhost:8070 ./scripts/install-runner.sh
set -euo pipefail
: "${SUPERVISOR_URL:?set SUPERVISOR_URL}"
: "${RUNNER_EXECUTOR:=docker}"
: "${RUNNER_NODE_ID:=$(hostname)}"
BIN="/usr/local/bin/runner"
if ! command -v runner >/dev/null 2>&1; then
  echo "runner binary missing" >&2
  exit 1
fi
cat >/etc/systemd/system/thatdam-runner.service <<UNIT
[Unit]
Description=ThatDAM Runner
After=network-online.target
Wants=network-online.target

[Service]
Environment=SUPERVISOR_URL=${SUPERVISOR_URL}
Environment=RUNNER_EXECUTOR=${RUNNER_EXECUTOR}
Environment=RUNNER_NODE_ID=${RUNNER_NODE_ID}
ExecStart=${BIN}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now thatdam-runner.service
