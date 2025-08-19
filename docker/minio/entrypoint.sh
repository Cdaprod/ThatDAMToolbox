#!/usr/bin/env bash
# MinIO entrypoint for That DAM Toolbox.
# Starts the server and ensures configured buckets exist.
#
# Usage:
#   MINIO_ROOT_USER=minio MINIO_ROOT_PASSWORD=minio123 ./entrypoint.sh
#
# Example:
#   docker run --rm \
#     -e MINIO_ROOT_USER=minio \
#     -e MINIO_ROOT_PASSWORD=minio123 \
#     -e MINIO_BUCKET_MEDIA=media \
#     thatdamtoolbox-minio

set -euo pipefail

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

MINIO_BUCKET_MEDIA="${MINIO_BUCKET_MEDIA:-}"
MINIO_BUCKET_WEAVIATE_BACKUPS="${MINIO_BUCKET_WEAVIATE_BACKUPS:-}"

/usr/bin/minio server /data --console-address :9001 >/proc/1/fd/1 2>/proc/1/fd/2 &
MINIO_PID=$!

for i in $(seq 1 60); do
  if wget -qO- http://127.0.0.1:9000/minio/health/ready >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
  if ! kill -0 "$MINIO_PID" 2>/dev/null; then
    echo "MinIO exited unexpectedly" >&2
    wait "$MINIO_PID"
    exit 1
  fi
done
if [[ "${READY:-0}" -ne 1 ]]; then
  echo "Timed out waiting for MinIO readiness" >&2
  kill "$MINIO_PID" 2>/dev/null || true
  exit 1
fi

mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

ensure_bucket() {
  local bucket="$1"
  [[ -z "$bucket" ]] && return 0
  mc ls "local/${bucket}" >/dev/null 2>&1 || mc mb "local/${bucket}" >/dev/null
}

ensure_bucket "$MINIO_BUCKET_MEDIA"
ensure_bucket "$MINIO_BUCKET_WEAVIATE_BACKUPS"

wait "$MINIO_PID"
