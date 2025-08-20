# syntax=docker/dockerfile:1.6

# Optionally pin MinIO server version; override at build time
ARG MINIO_VERSION=RELEASE.2024-03-15T01-07-19Z
ARG TARGETARCH

# ── Stage: fetch MinIO Client (mc) ─────────
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

# ── Final: MinIO server + your entrypoint + mc ─────────
FROM minio/minio:${MINIO_VERSION}
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - minio" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG

# Add the client and entrypoint (NOTE: no package installs; base has no package mgr)
COPY --from=mcget /mc /usr/bin/mc
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Force our minimal entrypoint; do NOT source any repo-wide shared entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["server","/data","--console-address",":9001"]