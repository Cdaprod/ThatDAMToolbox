#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# reusable helpers
# ---------------------------------------------------------------------------
VIDEO_MEDIA_ROOT=${VIDEO_MEDIA_ROOT:-/var/lib/thatdamtoolbox/media}

dirs=(
  /var/lib/thatdamtoolbox/db
  /var/lib/thatdamtoolbox/tmp
  /var/lib/thatdamtoolbox/media
  /var/lib/thatdamtoolbox/_PROCESSED
  /var/lib/thatdamtoolbox/previews
  /var/lib/thatdamtoolbox/logs
  /var/lib/thatdamtoolbox/_INCOMING
)

fix_perms() {
  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] && chown -R appuser:appuser "$d"
  done
}

run_as_appuser() {
  if   command -v su-exec &>/dev/null; then exec su-exec  appuser "$@"
  elif command -v gosu    &>/dev/null; then exec gosu     appuser "$@"
  elif command -v runuser &>/dev/null; then exec runuser  -u appuser -- "$@"
  else # last-ditch: BusyBox su (requires no-password pam)
       exec su -s /bin/bash appuser -c "$(printf '%q ' "$@")"
  fi
}

# ---------------------------------------------------------------------------
# 1) permission fix (root only)
# ---------------------------------------------------------------------------
if [[ $(id -u) -eq 0 ]]; then
  fix_perms
fi

# ---------------------------------------------------------------------------
# 2) one-time DB hydration
# ---------------------------------------------------------------------------
if [[ -d "$VIDEO_MEDIA_ROOT" && -z $(ls -A "$VIDEO_MEDIA_ROOT") ]]; then
  echo "[entrypoint] 🌱 initial scan of ${VIDEO_MEDIA_ROOT}"
  run_as_appuser python -m video scan --root "$VIDEO_MEDIA_ROOT" --workers 1
fi

# ---------------------------------------------------------------------------
# 3) main dispatch
# ---------------------------------------------------------------------------
# Plain `docker run`  ➜  serve API
# Extra args         ➜  pass through to `python -m video …`
#
if [[ $# -eq 0 ]]; then
  # no arguments ⇒ start API
  run_as_appuser python -m video serve --host 0.0.0.0 --port 8080
else
  # explicitly whitelisted CLI verbs keep their sub-command
  case "$1" in
    serve|scan|stats)
      sub="$1"; shift
      run_as_appuser python -m video "$sub" "$@"
      ;;
    *)
      # anything else: exec directly (debug shells, etc.)
      run_as_appuser "$@"
      ;;
  esac
fi