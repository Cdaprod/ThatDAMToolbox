#!/bin/bash
set -e

# Directories to fix
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
    [ -d "$d" ] && chown -R appuser:appuser "$d" || true
  done
}

# Helper: run as appuser using su-exec, gosu, or su
run_as_appuser() {
  if command -v su-exec >/dev/null 2>&1; then
    exec su-exec appuser "$@"
  elif command -v gosu >/dev/null 2>&1; then
    exec gosu appuser "$@"
  else
    exec su -s /bin/bash appuser -c "$(printf '%q ' "$@")"
  fi
}

if [ "$(id -u)" = "0" ]; then
  fix_perms
  # Re-invoke as appuser
  if [[ $# -eq 0 ]]; then
    run_as_appuser python -m video
  else
    case "$1" in
      serve|stats|scan)
        shift
        run_as_appuser python -m video "$@"
        ;;
      ""|0.0.0.0|127.0.0.1)
        # Just run the API server
        run_as_appuser python -m video
        ;;
      *)
        run_as_appuser "$@"
        ;;
    esac
  fi
else
  # Not root; just exec as-is
  if [[ $# -eq 0 ]]; then
    exec python -m video
  else
    case "$1" in
      serve|stats|scan)
        # shift
        exec python -m video "$@"
        ;;
      *)
        exec "$@"
        ;;
    esac
  fi
fi

for d in "${dirs[@]}"; do
  if [ ! -w "$d" ]; then
    echo "WARNING: $d is not writable by $(whoami)"
  fi
done