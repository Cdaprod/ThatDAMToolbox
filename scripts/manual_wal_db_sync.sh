#!/bin/sh
set -eu
LIVE=/var/lib/thatdam/db/media_index.sqlite3
COLD=/data/db/media_index.sqlite3

sqlite3 "$LIVE" 'PRAGMA wal_checkpoint(TRUNCATE);'
sqlite3 "$LIVE" ".backup '$COLD.tmp'"
mv -f "$COLD.tmp" "$COLD"