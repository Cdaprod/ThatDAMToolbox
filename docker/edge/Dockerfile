# Dockerfile for thatdam-run edge executable
# Build with: docker build -f docker/edge/Dockerfile .

# Build your edge single-executable image (language-agnostic skeleton)
FROM scratch AS empty

# --- builder stage (example: replace with your real build) ---
FROM alpine:3.20 AS builder
ARG VERSION
ARG GIT_SHA
ARG CHANNEL
WORKDIR /build
# COPY your sources and build the binary here; placeholder:
RUN echo "stub edge binary ${VERSION}-${GIT_SHA}-${CHANNEL}" > thatdam-run && chmod +x thatdam-run

# --- runtime stage ---
FROM alpine:3.20
ARG VERSION
ARG GIT_SHA
ARG CHANNEL
ARG BUILD_DATE
ARG MATRIX="linux/amd64,linux/arm64"

# OCI labels
LABEL org.opencontainers.image.title="thatdam-run" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/Cdaprod/ThatDAMToolbox" \
      cda.channel="${CHANNEL}" \
      cda.matrix="${MATRIX}"

WORKDIR /app
COPY --from=builder /build/thatdam-run /usr/local/bin/thatdam-run

# health/metrics placeholders; wire your real ports as needed
EXPOSE 9999
ENTRYPOINT ["/usr/local/bin/thatdam-run"]
