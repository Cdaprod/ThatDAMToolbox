# syntax=docker/dockerfile:1.7

# Pin versions via build args; override in compose if needed
ARG MINIO_VERSION=RELEASE.2024-03-15T01-07-19Z
ARG MC_VERSION=RELEASE.2024-06-20T15-06-08Z

# ── Stage: fetch MinIO Client (mc) for the *target* platform ────────────
FROM --platform=$TARGETPLATFORM minio/mc:${MC_VERSION} AS mcget
# mc binary is at /usr/bin/mc

# ── Final: MinIO server + entrypoint + mc ───────────────────────────────
FROM minio/minio:${MINIO_VERSION}
COPY --from=mcget /usr/bin/mc /usr/bin/mc
COPY --chmod=0755 entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["server","/data","--console-address",":9001"]