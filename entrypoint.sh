#!/bin/bash
set -e

if [ "$(id -u)" = "0" ]; then
  for d in \
    /var/lib/thatdamtoolbox/db \
    /var/lib/thatdamtoolbox/tmp \
    /var/lib/thatdamtoolbox/media \
    /var/lib/thatdamtoolbox/_PROCESSED \
    /var/lib/thatdamtoolbox/previews \
    /var/lib/thatdamtoolbox/logs \
    /var/lib/thatdamtoolbox/_INCOMING
  do
    [ -d "$d" ] && chown -R appuser:appuser "$d" || true
  done
fi

if [[ $# -eq 0 ]]; then
  exec python -m video
else
  case "$1" in
    serve|stats|scan)
      exec python -m video "$@"
      ;;
    *)
      exec "$@"
      ;;
  esac
fi