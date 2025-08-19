#!/usr/bin/env bash
# run_with_dirs.sh - ensure directories then exec a command
# Usage: scripts/run_with_dirs.sh /path/one /path/two -- your-command
# Example: scripts/run_with_dirs.sh /var/lib/thatdamtoolbox/db /var/lib/thatdamtoolbox/media -- docker compose up
set -euo pipefail
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 DIR [DIR...] -- CMD" >&2
  exit 1
fi
DIRS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --) shift; break;;
    *) DIRS+=("$1"); shift;;
  esac
done
# call ensure-dirs with current uid/gid
if ! go run ./host/services/shared/platform/cmd/ensure-dirs "${DIRS[@]}"; then
  echo "directory ensure failed" >&2
  exit 1
fi
exec "$@"
