#!/usr/bin/env bash
# /thatdamtoolbox/entrypoint.sh
# Flexible, environment-aware runtime wrapper for the Video / DAM toolbox
set -euo pipefail

# ---------------------------------------------------------------------------
# Environment-based path configuration
# ---------------------------------------------------------------------------

# Use environment variables with fallbacks to the old hardcoded paths
VIDEO_DATA_DIR=${VIDEO_DATA_DIR:-/var/lib/thatdamtoolbox}
VIDEO_MEDIA_ROOT=${VIDEO_MEDIA_ROOT:-${VIDEO_DATA_DIR}/media}
VIDEO_DB_PATH=${VIDEO_DB_PATH:-${VIDEO_DATA_DIR}/db/live.sqlite3}
VIDEO_PROCESSED_ROOT=${VIDEO_PROCESSED_ROOT:-${VIDEO_DATA_DIR}/_PROCESSED}
VIDEO_PREVIEW_ROOT=${VIDEO_PREVIEW_ROOT:-${VIDEO_DATA_DIR}/previews}
VIDEO_LOG_DIR=${VIDEO_LOG_DIR:-${VIDEO_DATA_DIR}/logs}

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

log() {
  echo "[entrypoint] $*" >&2
}

run_as_appuser() {
  # If we are already the unprivileged user, just exec the command.
  if [[ $(id -u) != 0 ]]; then
    exec "$@"
  fi

  # Otherwise drop from root → appuser with whatever helper exists.
  if   command -v su-exec &>/dev/null; then exec su-exec  appuser "$@"
  elif command -v gosu    &>/dev/null; then exec gosu     appuser "$@"
  elif command -v runuser &>/dev/null; then exec runuser  -u appuser -- "$@"
  else  exec su -s /bin/bash appuser -c "$(printf '%q ' "$@")"
  fi
}

check_environment() {
  log "🔍 Environment check:"
  log "  VIDEO_DATA_DIR: $VIDEO_DATA_DIR"
  log "  VIDEO_MEDIA_ROOT: $VIDEO_MEDIA_ROOT"
  log "  VIDEO_DB_PATH: $VIDEO_DB_PATH"
  log "  Current user: $(id -u):$(id -g)"
  
  # Check if running in Docker
  if [[ -f /.dockerenv ]]; then
    log "  Running in Docker container"
  fi
  
  # Check mount points
  log "  Mount points:"
  mount | grep -E "(${VIDEO_DATA_DIR%/*}|/data)" | while read -r line; do
    log "    $line"
  done || log "    No relevant mounts found"
}

initial_scan() {
  if [[ -d "$VIDEO_MEDIA_ROOT" ]]; then
    if [[ -z "$(ls -A "$VIDEO_MEDIA_ROOT" 2>/dev/null || true)" ]]; then
      log "🌱 Media directory is empty, performing initial scan..."
      run_as_appuser python -m video scan "$VIDEO_MEDIA_ROOT" --workers 1
    else
      log "📁 Media directory contains files, skipping initial scan"
    fi
  else
    log "⚠️  Media directory $VIDEO_MEDIA_ROOT does not exist"
  fi
}

# ---------------------------------------------------------------------------
# Main execution flow
# ---------------------------------------------------------------------------

# Show environment info (helpful for debugging)
if [[ "${VIDEO_DEBUG_BOOT:-0}" == "1" ]]; then
  check_environment
fi

# Initial scan if media directory is empty
initial_scan

# Main command dispatch
log "🚀 Starting application..."

if [[ $# -eq 0 ]]; then
  # Default: serve API
  log "No command specified, starting API server"
  run_as_appuser python -m video serve --host 0.0.0.0 --port 8080
else
  case "$1" in
    serve|scan|stats)
      sub=$1; shift
      log "Running video command: $sub $*"
      run_as_appuser python -m video "$sub" "$@"
      ;;
    *)
      # Fallthrough: run arbitrary command (e.g. bash)
      log "Running custom command: $*"
      run_as_appuser "$@"
      ;;
  esac
fi