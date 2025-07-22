#!/usr/bin/env bash
set -e

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
    [ -d "$d" ] && chown -R appuser:appuser "$d"
  done
}

run_as_appuser() {
  if command -v su-exec &>/dev/null; then
    su-exec appuser "$@"
  elif command -v gosu &>/dev/null; then
    gosu appuser "$@"
  else
    exec su -s /bin/bash appuser -c "$(printf '%q ' "$@")"
  fi
}

# 1) Fix perms so scan can write
if [ "$(id -u)" = "0" ]; then
  fix_perms
fi

# 2) One-time initial hydration if MEDIA_ROOT empty
if [ -d "${VIDEO_MEDIA_ROOT:-/var/lib/thatdamtoolbox/media}" ] && \
   [ -z "$(ls -A "${VIDEO_MEDIA_ROOT}")" ]; then
  echo "[entrypoint] 🌱 initial scan of ${VIDEO_MEDIA_ROOT}"
  run_as_appuser python -m video scan --root "${VIDEO_MEDIA_ROOT}" --workers 1
fi

# 3) Main dispatch
if [ "$(id -u)" = "0" ]; then
  # drop back to appuser for everything
  if [ $# -eq 0 ]; then
    exec su-exec appuser python -m video serve --host 0.0.0.0 --port 8080
  fi
  case "$1" in
    serve|scan|stats)
      cmd="$1"; shift
      exec su-exec appuser python -m video "$cmd" "$@"
      ;;
    *)
      exec su-exec appuser "$@"
      ;;
  esac
else
  # already appuser
  if [ $# -eq 0 ]; then
    exec python -m video serve --host 0.0.0.0 --port 8080
  fi
  case "$1" in
    serve|scan|stats)
      cmd="$1"; shift
      exec python -m video "$cmd" "$@"
      ;;
    *)
      exec "$@"
      ;;
  esac
fi