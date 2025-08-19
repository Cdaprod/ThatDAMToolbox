# syntax=docker/dockerfile:1.6

# Optionally pin MinIO server version; override at build time
ARG MINIO_VERSION=RELEASE.2024-03-15T01-07-19Z
# Let BuildKit provide target arch; fall back to uname -m when unset
ARG TARGETARCH

# ── Stage: fetch MinIO Client (mc) without relying on minio/mc tags ─────────
FROM --platform=$BUILDPLATFORM alpine:3.20 AS mcget
ARG TARGETARCH
RUN apk add --no-cache ca-certificates wget
RUN set -eux; \
  arch="${TARGETARCH:-$(uname -m)}"; \
  case "$arch" in \
    arm64|aarch64) mc_arch=arm64 ;; \
    amd64|x86_64)  mc_arch=amd64 ;; \
    *)             mc_arch=amd64 ;; \
  esac; \
  wget -O /mc "https://dl.min.io/client/mc/release/linux-${mc_arch}/mc"; \
  chmod +x /mc

# ── Stage: MinIO server + your entrypoint + mc ──────────────────────────────
FROM minio/minio:${MINIO_VERSION}
# If you'd rather not pin, you can use :latest, but pinning is safer for CI reproducibility.

# Add the client and entrypoint
COPY --from=mcget /mc /usr/bin/mc
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["server","/data","--console-address",":9001"]
