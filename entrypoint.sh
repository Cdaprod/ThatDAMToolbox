#!/usr/bin/env bash
# /thatdamtoolbox/entrypoint.sh
# Minimal, tini-friendly runtime wrapper for the Video / DAM toolbox
set -euo pipefail

# ---------------------------------------------------------------------------
# constants & helper functions
# ---------------------------------------------------------------------------
VIDEO_MEDIA_ROOT=${VIDEO_MEDIA_ROOT:-/var/lib/thatdamtoolbox/media}

declare -a DATA_DIRS=(
  /var/lib/thatdamtoolbox/db
  /var/lib/thatdamtoolbox/tmp
  /var/lib/thatdamtoolbox/media
  /var/lib/thatdamtoolbox/_PROCESSED
  /var/lib/thatdamtoolbox/previews
  /var/lib/thatdamtoolbox/logs
  /var/lib/thatdamtoolbox/_INCOMING
)

fix_perms() {
  for d in "${DATA_DIRS[@]}"; do
    [[ -d $d ]] && chown -R appuser:appuser "$d"
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

# ---------------------------------------------------------------------------
# 1) permissions (root only)
# ---------------------------------------------------------------------------
[[ $(id -u) == 0 ]] && fix_perms

# ---------------------------------------------------------------------------
# 2) one-time DB hydrate (empty media dir ⇒ first start)
# ---------------------------------------------------------------------------
if [[ -d $VIDEO_MEDIA_ROOT && -z $(ls -A "$VIDEO_MEDIA_ROOT") ]]; then
  echo "[entrypoint] 🌱 initial scan of $VIDEO_MEDIA_ROOT"
  run_as_appuser python -m video scan "$VIDEO_MEDIA_ROOT" --workers 1
fi

# ---------------------------------------------------------------------------
# 3) main dispatch
# ---------------------------------------------------------------------------
if [[ $# -eq 0 ]]; then
  # plain `docker run image`  → serve API
  run_as_appuser python -m video serve --host 0.0.0.0 --port 8080
else
  case "$1" in
    serve|scan|stats)
      sub=$1; shift
      run_as_appuser python -m video "$sub" "$@"
      ;;
    *)
      # fallthrough: run arbitrary command (e.g. bash)
      run_as_appuser "$@"
      ;;
  esac
fi