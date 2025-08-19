#!/usr/bin/env bash
# install-runner.sh installs and starts the runner via systemd.
#
# Usage:
#   ./scripts/install-runner.sh --supervisor URL [--executor TYPE] [--claim TOKEN] \
#       [--role-hint ROLE] [--labels LIST]
# Example (claim enrollment):
#   ./scripts/install-runner.sh --supervisor http://localhost:8070 \
#       --claim "$(curl -fsSL http://localhost:8070/v1/runner/claim?node_id=$(hostname))"
#
# Exits non-zero on failure.

set -euo pipefail

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
}

SUPERVISOR_URL=""
RUNNER_EXECUTOR="docker"
CLAIM_TOKEN=""
ROLE_HINT=""
LABELS=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --supervisor)
      SUPERVISOR_URL="$2"; shift 2 ;;
    --executor)
      RUNNER_EXECUTOR="$2"; shift 2 ;;
    --claim)
      CLAIM_TOKEN="$2"; shift 2 ;;
    --role-hint)
      ROLE_HINT="$2"; shift 2 ;;
    --labels)
      LABELS="$2"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$SUPERVISOR_URL" ]]; then
  echo "--supervisor required" >&2
  exit 1
fi

RUNNER_NODE_ID="${RUNNER_NODE_ID:-$(hostname)}"

BIN="${BIN:-$(command -v runner 2>/dev/null || true)}"
if [[ -z "$BIN" ]]; then
  echo "runner binary missing" >&2
  exit 1
fi

RUNNER_ENV_FILE="${RUNNER_ENV_FILE:-/etc/cda/runner.env}"
SYSTEMD_UNIT_FILE="${SYSTEMD_UNIT_FILE:-/etc/systemd/system/thatdam-runner.service}"

mkdir -p "$(dirname "$RUNNER_ENV_FILE")"
cat >"$RUNNER_ENV_FILE" <<ENV
SUPERVISOR_URL=${SUPERVISOR_URL}
RUNNER_EXECUTOR=${RUNNER_EXECUTOR}
RUNNER_NODE_ID=${RUNNER_NODE_ID}
ENV
[[ -n "$CLAIM_TOKEN" ]] && echo "RUNNER_CLAIM_TOKEN=${CLAIM_TOKEN}" >>"$RUNNER_ENV_FILE"
[[ -n "$ROLE_HINT" ]] && echo "RUNNER_ROLE_HINT=${ROLE_HINT}" >>"$RUNNER_ENV_FILE"
[[ -n "$LABELS" ]] && echo "RUNNER_LABELS=${LABELS}" >>"$RUNNER_ENV_FILE"

mkdir -p "$(dirname "$SYSTEMD_UNIT_FILE")"
cat >"$SYSTEMD_UNIT_FILE" <<UNIT
[Unit]
Description=ThatDAM Runner
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=${RUNNER_ENV_FILE}
ExecStart=${BIN}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
SERVICE_NAME="$(basename "$SYSTEMD_UNIT_FILE" .service)"
systemctl enable --now "${SERVICE_NAME}.service"
