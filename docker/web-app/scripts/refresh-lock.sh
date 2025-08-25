#!/usr/bin/env bash
# refresh-lock.sh - clean modules and refresh package-lock.json
# Usage: ./scripts/refresh-lock.sh
# Example:
#   bash scripts/refresh-lock.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "\U0001F9F9 Cleaning modules & refreshing lockfile…"
rm -rf node_modules
if npm install; then
  npm dedupe >/dev/null 2>&1 || true
  npm ci --package-lock-only --ignore-scripts
  echo "\u2705 Lockfile refreshed."
else
  echo "\u274c npm install failed" >&2
  exit 1
fi
