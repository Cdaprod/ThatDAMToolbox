# summary

# TODO: MinIO + Weaviate + Postgres Integration (BlobStore-Aware)

This document captures the current decisions and compose snippets for
running the **ThatDAM Toolbox** stack with MinIO, Weaviate, and Postgres
--- all aligned with the new low-level `BlobStore` abstraction in the
Golang services.

------------------------------------------------------------------------

## 🎯 Goals

-   Provide consistent, infra-grade services for object storage (MinIO),
    vector DB (Weaviate), and relational DB (Postgres).
-   Support the new **BlobStore / Catalog split** in Go services.
-   Keep the system usable **with or without** external infra (services
    hydrate themselves).
-   Standardize on a single entrypoint-driven bootstrap for MinIO
    (buckets, CORS, service accounts).

------------------------------------------------------------------------

## ✅ Decisions

1.  **MinIO** is built from `./docker/minio/` with a custom
    `entrypoint.sh`.

    -   Buckets are driven by `MINIO_BOOTSTRAP_BUCKETS`
        (space/comma-separated).
    -   Optional flags:
        -   `MINIO_MEDIA_PUBLIC=true` → make the `media` bucket publicly
            readable.
        -   `MINIO_MEDIA_CORS_JSON='[{"AllowedMethods":["GET","HEAD"],"AllowedOrigins":["*"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":300}]'`
            for CORS rules.
    -   Non-root app user is created via `MINIO_SVC_ACCESS_KEY` +
        `MINIO_SVC_SECRET_KEY`, with least-privilege access to declared
        buckets.

2.  **Weaviate** is run with:

    -   `backup-s3` module enabled.
    -   Targets MinIO's `weaviate-backups` bucket via the **non-root app
        credentials**.
    -   Supports optional Postgres persistence.

3.  **Postgres** runs standalone, used by Weaviate for persistence.

4.  **Root `docker-compose.yaml`** continues to `include:`:

    -   `docker/compose/docker-compose.minio.yaml`
    -   `docker/compose/docker-compose.weaviate.yaml`
    -   `docker/compose/docker-compose.postgres.yaml`

5.  All services join the **`damnet`** bridge network.

------------------------------------------------------------------------

## 🐳 Compose Snippets

### docker/compose/docker-compose.minio.yaml

``` yaml
services:
  minio:
    build:
      context: ./docker/minio
    image: thatdamtoolbox-minio:local
    container_name: thatdamtoolbox-minio
    command: ["server", "/data", "--console-address", ":9001"]
    environment:
      MINIO_ROOT_USER:     minio
      MINIO_ROOT_PASSWORD: minio123
      MINIO_BOOTSTRAP_BUCKETS: "media weaviate-backups"
      MINIO_MEDIA_PUBLIC: "true"
      # MINIO_MEDIA_CORS_JSON: '[{"AllowedMethods":["GET","HEAD"],"AllowedOrigins":["*"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":300}]'
      MINIO_NOTIFY_WEBHOOK_ENABLE_primary: "on"
      MINIO_NOTIFY_WEBHOOK_ENDPOINT_primary: "http://webhook:5000/events"
      MINIO_NOTIFY_WEBHOOK_AUTH_TOKEN_primary: ""
      MINIO_SVC_ACCESS_KEY:  thatdam_app
      MINIO_SVC_SECRET_KEY:  thatdam_app_secret
    ports: ["9000:9000","9001:9001"]
    volumes: ["./docker/minio/data:/data"]
    healthcheck:
      test: ["CMD","curl","-fsS","http://localhost:9000/minio/health/ready"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    networks: [damnet]
```

------------------------------------------------------------------------

### docker/compose/docker-compose.postgres.yaml

``` yaml
services:
  postgres:
    image: postgres:15
    container_name: thatdamtoolbox-weaviate_pg
    environment:
      POSTGRES_USER:      weaviate
      POSTGRES_PASSWORD:  weaviate
      POSTGRES_DB:        weaviate
      PGDATA:             /var/lib/postgresql/data/pgdata
    ports: ["5432:5432"]
    volumes:
      - ./docker/weaviate/data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD","pg_isready","-U","weaviate"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 10s
    restart: unless-stopped
    networks: [damnet]
```

------------------------------------------------------------------------

### docker/compose/docker-compose.weaviate.yaml

``` yaml
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    container_name: thatdamtoolbox-weaviate
    command: ["--host","0.0.0.0","--port","8080","--scheme","http"]
    ports: ["8082:8080","50051:50051"]
    environment:
      QUERY_DEFAULTS_LIMIT: "25"
      DEFAULT_VECTORIZER_MODULE: "none"
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "true"
      PERSISTENCE_DATA_PATH: /var/lib/weaviate
      ENABLE_MODULES: "backup-s3"
      BACKUP_S3_BUCKET: weaviate-backups
      BACKUP_S3_ENDPOINT: minio:9000
      BACKUP_S3_ACCESS_KEY_ID: thatdam_app
      BACKUP_S3_SECRET_ACCESS_KEY: thatdam_app_secret
      BACKUP_S3_USE_SSL: "false"
      POSTGRES_HOST: postgres
      POSTGRES_PORT: "5432"
      POSTGRES_USER: weaviate
      POSTGRES_PASSWORD: weaviate
      POSTGRES_DB: weaviate
      CLUSTER_HOSTNAME: node1
    volumes: ["./docker/weaviate/data/weaviate:/var/lib/weaviate"]
    depends_on:
      minio:
        condition: service_healthy
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD","wget","-qO-","http://localhost:8080/v1/.well-known/ready"]
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 15s
    restart: unless-stopped
    networks: [damnet]

  weaviate-schema-bootstrap:
    image: python:3.11
    depends_on:
      weaviate:
        condition: service_healthy
    volumes:
      - ./docker/weaviate:/weaviate:ro
    working_dir: /weaviate
    entrypoint: ["python", "bootstrap-schema.py"]
    environment:
      WEAVIATE_URL:   "http://weaviate:8080"
      WEAVIATE_SCHEMA: schema.json
    restart: "no"
    networks: [damnet]
```

------------------------------------------------------------------------

## 🔑 Key Takeaways

-   **Unified bootstrap**: MinIO entrypoint guarantees buckets, CORS,
    and service accounts exist idempotently.
-   **Single source of truth**: Root `docker-compose.yaml` pulls in
    infra with `include:` blocks; dev/prod variations handled with env
    overrides.
-   **BlobStore-first architecture**: Go services can ingest via in‑mem
    adapters or DFS even if MinIO/Weaviate/Postgres aren't running.
    External infra just hydrates itself.

------------------------------------------------------------------------

## 📌 Next Steps

-   Finalize `docker/minio/Dockerfile` + `entrypoint.sh` to respect
    `MINIO_BOOTSTRAP_BUCKETS`.
-   Wire capture-daemon → BlobStore → Catalog → Media-API using these
    infra services when available.
-   Add tests/docs for MinIO + Weaviate backup/restore flows.
-   Optionally define per-service service accounts for stricter RBAC in
    prod.


# about entrypoint

Awesome -- let’s lock this in and make it drop-in ready. Below are the three files you asked for, cleaned up, with CORS wired into entrypoint.sh and no external deps required at runtime (we bake mc into the image). I also swapped the readiness probe to use wget so we don’t need to install curl inside the image.

⸻

docker/minio/Dockerfile

# Build arg provided automatically by BuildKit/Compose
ARG TARGETARCH

# ── Stage 1: fetch MinIO Client (mc) for the right arch ─────────────────
FROM alpine:3.20 AS mcget
ARG TARGETARCH
RUN apk add --no-cache ca-certificates wget
RUN set -eux; \
    case "${TARGETARCH}" in \
      arm64)  ARCH=arm64  ;; \
      amd64)  ARCH=amd64  ;; \
      *)      ARCH=amd64  ;; \
    esac; \
    wget -O /mc "https://dl.min.io/client/mc/release/linux-${ARCH}/mc"; \
    chmod +x /mc

# ── Stage 2: MinIO server + our entrypoint + mc ─────────────────────────
FROM minio/minio:latest
# Copy minio client
COPY --from=mcget /mc /usr/bin/mc
# Copy our bootstrapper
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default CMD still starts minio; our entrypoint wraps it and configures
ENTRYPOINT ["/entrypoint.sh"]
CMD ["server","/data","--console-address",":9001"]


⸻

docker/minio/entrypoint.sh

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


⸻

docker/minio/data/
	•	This is just the host-bind mount target for object data (empty dir in your repo).
	•	Your compose already mounts it: - ./docker/minio/data:/data

⸻

Compose usage (recap)

You already have two compose variants:
	•	Root include: ./docker/compose/docker-compose.minio.yaml (uses this image)
	•	Advanced/local: ./docker/minio/docker-compose.minio.yaml

Both are fine. If you keep both, ensure they don’t collide (only include one in your root include: block at a time). The image name/tag can remain thatdamtoolbox-minio:local.

Environment examples (drop into whichever compose you’re using):

environment:
  MINIO_ROOT_USER:     minio
  MINIO_ROOT_PASSWORD: minio123

  # Buckets to auto-create
  MINIO_BUCKET_MEDIA:             media
  MINIO_BUCKET_WEAVIATE_BACKUPS:  weaviate-backups

  # Make the media bucket anonymously readable (optional)
  MINIO_MEDIA_PUBLIC: "true"

  # CORS for direct browser access to media
  MINIO_MEDIA_CORS_JSON: >-
    [{"AllowedMethods":["GET","HEAD"],
      "AllowedOrigins":["*"],
      "AllowedHeaders":["*"],
      "ExposeHeaders":["ETag"],
      "MaxAgeSeconds":300}]

  # Optional app creds (use per-service creds in prod)
  MINIO_SVC_ACCESS_KEY:  thatdam_app
  MINIO_SVC_SECRET_KEY:  thatdam_app_secret


⸻

Quick notes
	•	Your earlier pasted script had a duplicate block; the version above is the single, clean one.
	•	We intentionally used wget inside the entrypoint to avoid adding curl to the image.
	•	The CORS step uses mc bucket cors set first and falls back to an alternate command for version drift.
	•	This slots neatly into your architecture: your internal BlobStore keeps working even if MinIO is down, and when MinIO is up, it "hydrates" itself (buckets, policy, CORS) automatically.


# about making buckets from compose environment property

Can we have environment: MINIO_BOOTSTRAP_BUCKETS: []

Yes ✅ -- we can generalize the bucket creation logic so you don’t need a pile of MINIO_BUCKET_MEDIA, MINIO_BUCKET_WEAVIATE_BACKUPS, etc. Instead you declare one env var, MINIO_BOOTSTRAP_BUCKETS, as a comma- or space-separated list, and the entrypoint will iterate and create each.

That way your docker-compose.minio.yaml is cleaner, and your entrypoint.sh doesn’t need to grow each time you add a bucket.

⸻

Example usage in Compose

environment:
  MINIO_ROOT_USER:     minio
  MINIO_ROOT_PASSWORD: minio123

  # One var, many buckets:
  MINIO_BOOTSTRAP_BUCKETS: "media weaviate-backups auditlogs"

  MINIO_MEDIA_PUBLIC: "true"

  MINIO_MEDIA_CORS_JSON: >-
    [{"AllowedMethods":["GET","HEAD"],
      "AllowedOrigins":["*"],
      "AllowedHeaders":["*"],
      "ExposeHeaders":["ETag"],
      "MaxAgeSeconds":300}]


⸻

Patch for entrypoint.sh

Replace the separate MINIO_BUCKET_* bits with this:

# Buckets to create (space/comma separated)
MINIO_BOOTSTRAP_BUCKETS="${MINIO_BOOTSTRAP_BUCKETS:-}"

# ...

# Helper to ensure bucket exists
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
if [[ -n "${MINIO_BOOTSTRAP_BUCKETS}" ]]; then
  # split on commas or spaces
  for bucket in ${MINIO_BOOTSTRAP_BUCKETS//,/ }; do
    ensure_bucket "$bucket"
  done
fi


⸻

Public + CORS still handled

If you want to keep special behavior for the media bucket (public-read, CORS), you can keep:

if [[ "${MINIO_MEDIA_PUBLIC}" == "true" && "${MINIO_BOOTSTRAP_BUCKETS}" == *"media"* ]]; then
  echo "🔓 setting public-read on media"
  mc anonymous set download "local/media" >/dev/null
fi

if [[ -n "${MINIO_MEDIA_CORS_JSON}" && "${MINIO_BOOTSTRAP_BUCKETS}" == *"media"* ]]; then
  echo "🌐 applying CORS on media"
  # ... same as before
fi


⸻

👉 This way, adding new buckets doesn’t require touching your entrypoint. You just extend the list in MINIO_BOOTSTRAP_BUCKETS.

Would you like me to refactor your full entrypoint.sh to collapse MINIO_BUCKET_MEDIA and MINIO_BUCKET_WEAVIATE_BACKUPS into this generalized MINIO_BOOTSTRAP_BUCKETS approach? That way you’ll have one clean version to drop in.


# about priv

Totally--there’s a cleaner, more future-proof way than picking one global username.

The "better way" in a nutshell

Use per-service, least-privilege identities issued just-in-time by an IdP/issuer, not one static app user. Concretely:
	1.	Identity model
	•	Humans: thatdam-admin (ops), thatdam-operator (support).
	•	Machines (per service + env):
svc.video-api.dev, svc.capture-daemon.edge1, svc.camera-proxy.edge2, svc.media-importer.dev, etc.
	•	Optional tenant: svc.video-api.dev@acme if you go multi-tenant.
	2.	AuthN/AuthZ primitives
	•	OIDC/JWT everywhere possible; fall back to static creds only for dev.
	•	Short-lived creds via STS/dynamic issuance:
	•	MinIO: STS with OIDC (AssumeRoleWithWebIdentity) → temporary S3 keys bound to policy.
	•	Postgres: dynamic DB users (HashiCorp Vault DB engine) mapped to roles.
	•	Weaviate: enable OIDC (or API keys now, OIDC later) with role claims → class/operation RBAC.
	3.	RBAC by service (not by "the app")
	•	Example buckets/DB/schema permissions:
	•	svc.capture-daemon.* → s3:PutObject to thatdam/ingest/*, no delete.
	•	svc.video-api.* → read from thatdam/*, write only to thatdam/previews/*.
	•	svc.media-importer.* → list + put in thatdam/import/*, no access to ingest/.
	•	Postgres: schema owner role (admin only), runtime roles (service-scoped) with only SELECT/INSERT on specific tables.
	•	Weaviate: video-api can CRUD VideoAsset; capture-daemon can create CaptureEvent but not delete assets.
	4.	Naming that scales
	•	svc.<service>.<env>[.<site>] (machine) and human.<role> (people).
Examples: svc.video-api.prod, svc.capture-daemon.rpi5-2, human.thatdam-admin.
	5.	Secret management + rotation
	•	Dev: docker-compose .env with static test secrets.
	•	Stage/Prod: Vault (or SSM/Secrets Manager) issues:
	•	MinIO STS credentials (15–60 min TTL).
	•	Postgres users (4–24 hr TTL).
	•	JWTs for Weaviate via your IdP (Keycloak/Auth0/Okta).

⸻

Practical migration plan (no boil-the-ocean)

Phase 0 (now, compose/dev)

Keep it simple but prepare the shape:
	•	Create multiple static users instead of one:
	•	svc.capture-daemon.dev
	•	svc.video-api.dev
	•	human.thatdam-admin
	•	MinIO: per-service access keys with minimal policies.
	•	Postgres: split schema owner (thatdamadmin) from runtime (svc.video_api_dev, svc_capture_daemon_dev).
	•	Weaviate: enable API key auth with per-service keys (or OIDC later).

Phase 1 (soon)
	•	Stand up Keycloak (or your IdP).
	•	Switch MinIO to OIDC/STS; map sub/aud to MinIO policies.
	•	Switch Weaviate to OIDC; map JWT roles to Weaviate RBAC.
	•	Put static Postgres passwords behind Vault while you wire up dynamic creds.

Phase 2 (later)
	•	Postgres → Vault dynamic users only; retire static DB passwords.
	•	Rotate MinIO to STS only; no long-lived S3 keys in services.
	•	Enforce mTLS east-west (optional but nice).

⸻

Concrete snippets to get you started

1) MinIO (dev) – per-service users + policies

Create two service accounts and least-privilege policies:

Policy: capture-daemon can only PUT to ingest/

{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["s3:PutObject"],"Resource":["arn:aws:s3:::thatdam/ingest/*"]},
    {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::thatdam"],"Condition":{"StringLike":{"s3:prefix":["ingest/*"]}}}
  ]
}

Policy: video-api can GET from all, PUT to previews/

{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::thatdam/*"]},
    {"Effect":"Allow","Action":["s3:PutObject"],"Resource":["arn:aws:s3:::thatdam/previews/*"]},
    {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::thatdam"]}
  ]
}

Apply with mc:

mc alias set minio http://localhost:9000 minio minio123
mc admin user add minio svc.capture-daemon.dev <secret1>
mc admin user add minio svc.video-api.dev     <secret2>

mc admin policy create minio policy-capture-daemon capture-daemon.json
mc admin policy create minio policy-video-api     video-api.json

mc admin policy attach minio policy-capture-daemon --user svc.capture-daemon.dev
mc admin policy attach minio policy-video-api     --user svc.video-api.dev

mc mb -p minio/thatdam

(When you move to OIDC/STSs, these policies stay; the principals become JWT-assumed roles instead of static users.)

2) Postgres – split ownership from runtime

-- One-time: schema owner (admin use only)
CREATE ROLE thatdamadmin WITH LOGIN PASSWORD '...';

-- Runtime roles (per service)
CREATE ROLE svc_video_api_dev       WITH LOGIN PASSWORD '...';
CREATE ROLE svc_capture_daemon_dev  WITH LOGIN PASSWORD '...';

-- App schema owned by admin; runtime roles get limited rights
CREATE SCHEMA IF NOT EXISTS dam AUTHORIZATION thatdamadmin;

GRANT USAGE ON SCHEMA dam TO svc_video_api_dev, svc_capture_daemon_dev;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA dam TO svc_video_api_dev;
GRANT SELECT, INSERT          ON ALL TABLES IN SCHEMA dam TO svc_capture_daemon_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA dam GRANT SELECT, INSERT, UPDATE ON TABLES TO svc_video_api_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA dam GRANT SELECT, INSERT          ON TABLES TO svc_capture_daemon_dev;

3) Weaviate – API keys now, OIDC later

Dev compose:

environment:
  AUTHENTICATION_APIKEY_ENABLED: "true"
  AUTHENTICATION_APIKEY_ALLOWED_KEYS: "key-video-api-dev,key-capture-daemon-dev"
  AUTHENTICATION_APIKEY_USERS: "svc.video-api.dev,svc.capture-daemon.dev"

Later, flip to OIDC:

environment:
  AUTHENTICATION_OIDC_ENABLED: "true"
  OIDC_ISSUER: "https://keycloak/realms/thatdam"
  OIDC_CLIENT_ID: "weaviate"
  AUTHORIZATION_ADMINLIST_ENABLED: "true"
  AUTHORIZATION_ADMINLIST_USERS: "human.thatdam-admin"


⸻

Why this beats a single thatdamuser
	•	Blast radius is tiny per service.
	•	Rotation is trivial (rotate one principal).
	•	Observability: logs tell you which service did what.
	•	Future ready: easy hop to STS/OIDC and dynamic DB creds.

If you want, I can produce:
	•	A dev docker-compose overlay that creates the two MinIO users + policies at boot,
	•	A SQL bootstrap file for Postgres roles,
	•	A Weaviate env for API-key auth today with a commented OIDC block to switch on later.

This keeps your current compose flow intact but sets you up for the strong model above.