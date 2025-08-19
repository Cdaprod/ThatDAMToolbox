#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────
# Config via env (all optional except ROOT creds)
# ──────────────────────────────────────────────────────────────
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"

MINIO_ADDR="${MINIO_ADDR:-:9000}"
MINIO_CONSOLE_ADDR="${MINIO_CONSOLE_ADDR:-:9001}"

# Buckets to create if set
MINIO_BUCKET_MEDIA="${MINIO_BUCKET_MEDIA:-}"
MINIO_BUCKET_WEAVIATE_BACKUPS="${MINIO_BUCKET_WEAVIATE_BACKUPS:-}"

# Optional app (non-root) credentials
MINIO_SVC_ACCESS_KEY="${MINIO_SVC_ACCESS_KEY:-}"
MINIO_SVC_SECRET_KEY="${MINIO_SVC_SECRET_KEY:-}"

# Optional: make media bucket readable over HTTP by default
MINIO_MEDIA_PUBLIC="${MINIO_MEDIA_PUBLIC:-false}"

# Optional: CORS for media bucket (single-line JSON array)
MINIO_MEDIA_CORS_JSON="${MINIO_MEDIA_CORS_JSON:-}"

# ──────────────────────────────────────────────────────────────
# Start MinIO server in the background (pass through CMD args)
# ──────────────────────────────────────────────────────────────
/usr/bin/minio "$@" >/proc/1/fd/1 2>/proc/1/fd/2 &
MINIO_PID=$!

# ──────────────────────────────────────────────────────────────
# Wait for readiness
# ──────────────────────────────────────────────────────────────
# Extract the port from MINIO_ADDR (format ":9000" or "0.0.0.0:9000")
READY_PORT="${MINIO_ADDR##*:}"
[[ -z "$READY_PORT" ]] && READY_PORT="9000"

echo "🕒 waiting for MinIO to be ready on ${MINIO_ADDR}"
for i in {1..60}; do
  if wget -qO- "http://127.0.0.1:${READY_PORT}/minio/health/ready" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if ! kill -0 "$MINIO_PID" 2>/dev/null; then
    echo "MinIO server exited unexpectedly"; wait "$MINIO_PID"; exit 1
  fi
done

# ──────────────────────────────────────────────────────────────
# Configure via mc (idempotent)
# ──────────────────────────────────────────────────────────────
mc alias set local "http://127.0.0.1:${READY_PORT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null

ensure_bucket() {
  local bucket="$1"
  [[ -z "$bucket" ]] && return 0
  if ! mc ls "local/${bucket}" >/dev/null 2>&1; then
    echo "🪣 creating bucket: ${bucket}"
    mc mb "local/${bucket}" >/dev/null
  else
    echo "🪣 bucket exists: ${bucket}"
  fi
}

# Create requested buckets
ensure_bucket "$MINIO_BUCKET_MEDIA"
ensure_bucket "$MINIO_BUCKET_WEAVIATE_BACKUPS"

# Public-read policy for media (optional)
if [[ "${MINIO_MEDIA_PUBLIC}" == "true" && -n "${MINIO_BUCKET_MEDIA}" ]]; then
  echo "🔓 setting public-read on ${MINIO_BUCKET_MEDIA}"
  mc anonymous set download "local/${MINIO_BUCKET_MEDIA}" >/dev/null
fi

# CORS for media (optional)
if [[ -n "${MINIO_MEDIA_CORS_JSON}" && -n "${MINIO_BUCKET_MEDIA}" ]]; then
  echo "🌐 applying CORS on ${MINIO_BUCKET_MEDIA}"
  tmpcors="$(mktemp)"
  echo "${MINIO_MEDIA_CORS_JSON}" > "${tmpcors}"
  # Most mc versions support this:
  if mc bucket cors set "local/${MINIO_BUCKET_MEDIA}" "${tmpcors}" >/dev/null 2>&1; then
    :
  else
    # Fallback (older/newer syntax drift)
    mc anonymous set-json cors "local/${MINIO_BUCKET_MEDIA}" "${tmpcors}" >/dev/null || true
  fi
  rm -f "${tmpcors}"
fi

# App service account (non-root) with least-priv policy (optional)
if [[ -n "${MINIO_SVC_ACCESS_KEY}" && -n "${MINIO_SVC_SECRET_KEY}" ]]; then
  echo "👤 ensuring service user exists"
  if ! mc admin user info local "${MINIO_SVC_ACCESS_KEY}" >/dev/null 2>&1; then
    mc admin user add local "${MINIO_SVC_ACCESS_KEY}" "${MINIO_SVC_SECRET_KEY}" >/dev/null
  fi

  # Build a least-privilege policy covering whichever buckets exist
  tmppol="$(mktemp)"
  cat > "${tmppol}" <<'JSON'
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Sid":"ListBuckets",
      "Effect":"Allow",
      "Action":["s3:ListAllMyBuckets","s3:ListBucket"],
      "Resource":["arn:aws:s3:::*"]
    }
  ]
}
JSON

  append_bucket_rw() {
    local b="$1"
    [[ -z "$b" ]] && return
    cat > "${tmppol}.bkt" <<JSON
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Sid":"ListBuckets",
      "Effect":"Allow",
      "Action":["s3:ListAllMyBuckets","s3:ListBucket"],
      "Resource":["arn:aws:s3:::*"]
    },
    {
      "Sid":"RW_${b}",
      "Effect":"Allow",
      "Action":["s3:PutObject","s3:GetObject","s3:DeleteObject","s3:AbortMultipartUpload","s3:ListBucket","s3:ListBucketMultipartUploads"],
      "Resource": [
        "arn:aws:s3:::${b}",
        "arn:aws:s3:::${b}/*"
      ]
    }
  ]
}
JSON
    mv "${tmppol}.bkt" "${tmppol}"
  }

  append_bucket_rw "$MINIO_BUCKET_MEDIA"
  append_bucket_rw "$MINIO_BUCKET_WEAVIATE_BACKUPS"

  echo "🔐 attaching thatdam-app policy to service user"
  mc admin policy create local thatdam-app "${tmppol}" >/dev/null 2>&1 || true
  mc admin policy attach local thatdam-app --user "${MINIO_SVC_ACCESS_KEY}" >/dev/null || true
  rm -f "${tmppol}"
fi

echo "✅ MinIO bootstrapped"
wait "${MINIO_PID}"
