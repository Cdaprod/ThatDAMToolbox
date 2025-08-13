#!/usr/bin/env bash
# /thatdamtoolbox/entrypoint.sh
# Flexible, environment-aware runtime wrapper for the Video / DAM toolbox
set -euo pipefail

# Optional discovery role resolution
if [ -f /opt/shared/entrypoint-snippet.sh ]; then
  # shellcheck disable=SC1091
  . /opt/shared/entrypoint-snippet.sh
fi

if [ "${ROLE:-server}" = "agent" ]; then
  export EVENT_BROKER_URL="${EVENT_BROKER_URL:-amqp://video:video@${UPSTREAM_HOST}:${UPSTREAM_PORT:-5672}/}"
  UPSTREAM_ARG=(--upstream "http://${UPSTREAM_HOST}:${UPSTREAM_PORT:-8080}")
else
  UPSTREAM_ARG=()
fi

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

# Extract the database directory from the full path
VIDEO_DB_DIR=$(dirname "$VIDEO_DB_PATH")

# Build data directories array from environment variables
declare -a DATA_DIRS=(
  "$VIDEO_DB_DIR"
  "${VIDEO_DATA_DIR}/tmp"
  "$VIDEO_MEDIA_ROOT"
  "$VIDEO_PROCESSED_ROOT"
  "$VIDEO_PREVIEW_ROOT"
  "$VIDEO_LOG_DIR"
  "${VIDEO_DATA_DIR}/_INCOMING"
)

# Add cache directories if specified
[[ -n "${XDG_CACHE_HOME:-}" ]] && DATA_DIRS+=("$XDG_CACHE_HOME")
[[ -n "${HF_HOME:-}" ]] && DATA_DIRS+=("$HF_HOME")
[[ -n "${TORCH_HOME:-}" ]] && DATA_DIRS+=("$TORCH_HOME")

# ---------------------------------------------------------------------------
# Extra module-specific data roots
# ---------------------------------------------------------------------------
MODULES_ROOT=${MODULES_ROOT:-/data/modules}

# Explicit DAM sub-folders we know the app will touch
declare -a DAM_DIRS=(
  "${MODULES_ROOT}/dam/cache"
  "${MODULES_ROOT}/dam/embeddings"
  "${MODULES_ROOT}/dam/manifests"
  "${MODULES_ROOT}/dam/previews"
)

# Append to the master list
DATA_DIRS+=("${DAM_DIRS[@]}")

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

log() {
  echo "[entrypoint] $*" >&2
}

create_directories() {
  log "🏗️  Creating required directories..."
  for d in "${DATA_DIRS[@]}"; do
    if [[ ! -d "$d" ]]; then
      log "Creating directory: $d"
      mkdir -p "$d"
    fi
  done
}

fix_perms() {
  log "🔧 Fixing permissions..."
  for d in "${DATA_DIRS[@]}"; do
    if [[ -d "$d" ]]; then
      log "Setting ownership for: $d"
      chown -R appuser:appuser "$d" 2>/dev/null || {
        log "⚠️  Could not change ownership of $d (continuing anyway)"
      }
    fi
  done
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

# 1) Create directories (can be done as any user)
create_directories

# 2) Fix permissions (root only)
if [[ $(id -u) == 0 ]]; then
  fix_perms
else
  log "🔒 Not running as root, skipping permission fix"
fi

# 3) Initial scan if media directory is empty
initial_scan

# 4) Main command dispatch
log "🚀 Starting application..."

if [[ $# -eq 0 ]]; then
  # Default: serve API
  log "No command specified, starting API server"
  run_as_appuser python -m video serve --host 0.0.0.0 --port "${SERVICE_PORT:-8080}" "${UPSTREAM_ARG[@]}"
else
  case "$1" in
    serve|scan|stats)
      sub=$1; shift
      log "Running video command: $sub $*"
      if [[ "$sub" = "serve" ]]; then
        run_as_appuser python -m video serve --host 0.0.0.0 --port "${SERVICE_PORT:-8080}" "${UPSTREAM_ARG[@]}" "$@"
      else
        run_as_appuser python -m video "$sub" "$@"
      fi
      ;;
    *)
      # Fallthrough: run arbitrary command (e.g. bash)
      log "Running custom command: $*"
      run_as_appuser "$@"
      ;;
  esac
fi
