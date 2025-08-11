#!/usr/bin/env bash
# Register a self-hosted GitHub Actions runner for the server/frontend box.
#
# Usage:
#   GH_OWNER=yourorg GH_REPO=ThatDAMToolbox GH_PAT=TOKEN \
#     ./scripts/register-runner-server.sh
#
# Example:
#   GH_OWNER=myorg GH_REPO=ThatDAMToolbox GH_PAT=ghp_123 \
#     ./scripts/register-runner-server.sh
#
# Exits non-zero on failure.
set -euo pipefail

if [[ -z "${GH_OWNER:-}" || -z "${GH_REPO:-}" || -z "${GH_PAT:-}" ]]; then
  echo "GH_OWNER, GH_REPO, and GH_PAT must be set" >&2
  exit 1
fi

curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64-3.651.0.tar.gz
mkdir -p ~/actions-runner && tar xzf actions-runner.tar.gz -C ~/actions-runner
cd ~/actions-runner
./config.sh --url "https://github.com/${GH_OWNER}/${GH_REPO}" \
            --token "${GH_PAT}" \
            --labels "self-hosted,linux,role-server" \
            --unattended
sudo ./svc.sh install
sudo ./svc.sh start
