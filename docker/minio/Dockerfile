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
FROM minio/minio:RELEASE.2024-03-15T01-07-19Z
# Copy minio client
COPY --from=mcget /mc /usr/bin/mc
# Copy our bootstrapper
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default CMD still starts minio; our entrypoint wraps it and configures
ENTRYPOINT ["/entrypoint.sh"]
CMD ["server","/data","--console-address",":9001"]
