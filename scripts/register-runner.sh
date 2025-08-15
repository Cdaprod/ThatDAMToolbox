#!/usr/bin/env bash
# Register a self-hosted GitHub Actions runner.
#
# Usage:
#   GH_OWNER=yourorg GH_REPO=ThatDAMToolbox GH_PAT=TOKEN RUNNER_ROLE=server \
#     ./scripts/register-runner.sh
#
# Example:
#   GH_OWNER=myorg GH_REPO=ThatDAMToolbox GH_PAT=ghp_123 RUNNER_ROLE=capture \
#     ./scripts/register-runner.sh
#
# Exits non-zero on failure.
set -euo pipefail

for var in GH_OWNER GH_REPO GH_PAT RUNNER_ROLE; do
  if [[ -z "${!var:-}" ]]; then
    echo "${var} must be set" >&2
    exit 1
  fi
done

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)
    RUNNER_ARCH="x64"
    ;;
  aarch64|arm64)
    RUNNER_ARCH="arm64"
    ;;
  armv7l|armv6l)
    RUNNER_ARCH="arm"
    ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

RUNNER_VERSION="3.651.0"
TARBALL="actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
URL="https://github.com/actions/runner/releases/latest/download/${TARBALL}"
RUNNER_DIR="${HOME}/actions-runner"

if [[ -n "${DRY_RUN:-}" ]]; then
  echo "DRY RUN: would download ${URL} and register runner in ${RUNNER_DIR}"
  exit 0
fi

if [[ ! -d "${RUNNER_DIR}" ]]; then
  curl -o actions-runner.tar.gz -L "${URL}"
  mkdir -p "${RUNNER_DIR}" && tar xzf actions-runner.tar.gz -C "${RUNNER_DIR}"
fi
cd "${RUNNER_DIR}"

if [[ ! -f .runner ]]; then
  ./config.sh --url "https://github.com/${GH_OWNER}/${GH_REPO}" \
              --token "${GH_PAT}" \
              --labels "self-hosted,linux,role-${RUNNER_ROLE}" \
              --unattended
fi

if ! ./svc.sh status >/dev/null 2>&1; then
  sudo ./svc.sh install
  sudo ./svc.sh start
fi
