#!/bin/bash
set -e

# Fix permissions on all media folders (ignore errors if already correct)
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

exec "$@"