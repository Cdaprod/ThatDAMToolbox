#!/usr/bin/env bash
# Minimal MinIO entrypoint for That DAM Toolbox (no su, no shared snippet)
set -euo pipefail

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

MINIO_BUCKET_MEDIA="${MINIO_BUCKET_MEDIA:-}"
MINIO_BUCKET_WEAVIATE_BACKUPS="${MINIO_BUCKET_WEAVIATE_BACKUPS:-}"
MINIO_MEDIA_PUBLIC="${MINIO_MEDIA_PUBLIC:-false}"
MINIO_MEDIA_CORS_JSON="${MINIO_MEDIA_CORS_JSON:-}"
MINIO_SVC_ACCESS_KEY="${MINIO_SVC_ACCESS_KEY:-}"
MINIO_SVC_SECRET_KEY="${MINIO_SVC_SECRET_KEY:-}"

# 1) start MinIO in background (no privilege dance)
#    NOTE: we don't source any shared entrypoint here
/usr/bin/minio server /data --console-address :9001 >/proc/1/fd/1 2>/proc/1/fd/2 &
MINIO_PID=$!

# 2) wait for readiness using mc (bundled in the image)
tries=0
until mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; \
   && mc admin info local >/dev/null 2>&1; do
  tries=$((tries+1))
  if ! kill -0 "$MINIO_PID" 2>/dev/null; then
    echo "MinIO exited unexpectedly" >&2
    wait "$MINIO_PID" || true
    exit 1
  fi
  if [ "$tries" -gt 120 ]; then
    echo "Timed out waiting for MinIO readiness" >&2
    kill "$MINIO_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# 3) ensure buckets
ensure_bucket() {
  local bucket="$1"
  [[ -z "$bucket" ]] && return 0
  mc ls "local/${bucket}" >/dev/null 2>&1 || mc mb "local/${bucket}" >/dev/null
}
ensure_bucket "$MINIO_BUCKET_MEDIA"
ensure_bucket "$MINIO_BUCKET_WEAVIATE_BACKUPS"

# 4) make media public if requested
if [[ "$MINIO_MEDIA_PUBLIC" == "true" && -n "$MINIO_BUCKET_MEDIA" ]]; then
  mc anonymous set download "local/${MINIO_BUCKET_MEDIA}" >/dev/null
fi

# 5) optional CORS for media
if [[ -n "$MINIO_MEDIA_CORS_JSON" && -n "$MINIO_BUCKET_MEDIA" ]]; then
  tmpcors=$(mktemp)
  printf '%s' "$MINIO_MEDIA_CORS_JSON" > "$tmpcors"
  mc cors set "local/${MINIO_BUCKET_MEDIA}" "$tmpcors" >/dev/null
  rm -f "$tmpcors"
fi

# 6) optional service account
if [[ -n "$MINIO_SVC_ACCESS_KEY" && -n "$MINIO_SVC_SECRET_KEY" ]]; then
  if ! mc admin user svcacct info local "$MINIO_SVC_ACCESS_KEY" >/dev/null 2>&1; then
    mc admin user svcacct add local "$MINIO_ROOT_USER" \
      --access-key "$MINIO_SVC_ACCESS_KEY" \
      --secret-key "$MINIO_SVC_SECRET_KEY" >/dev/null
  fi
fi

# 7) keep foreground
wait "$MINIO_PID"