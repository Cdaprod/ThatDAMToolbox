##############################################################################
# /Dockerfile
# 
#  🎥 Multi-arch container for the “video” Media-Bridge / DAM toolbox 🐳
#
# • Works on 64-bit x86 and ARM (incl. Raspberry Pi 5)
# • Uvicorn-with-Gunicorn FastAPI stack by default
# • Falls back to the stdlib HTTP server when FASTAPI=0 or FastAPI deps
#   are stripped at build-time
#
# Build examples
#   docker buildx build --platform linux/amd64,linux/arm64 -t cdaprod/video:0.1.0 .
#   docker run -p 8080:8080 cdaprod/video:0.1.0                # starts API
#   docker run cdaprod/video:0.1.0 scan --root /data           # CLI one-shot
##############################################################################

############################
# --- Stage 1: base layer --
############################
FROM python:3.11-slim-bookworm AS base
LABEL maintainer="cdaprod.dev" \
      org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.description="That DAM Toolbox - FastAPI / stdlib API + CLI + Modular Plugin System for the Media-Indexer toolbox" \
      org.opencontainers.image.version="0.1.0"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Minimal C tool-chain for any optional pure-C wheels; FFmpeg & libGL for preview
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        git curl wget ca-certificates \
        ffmpeg libgl1 libglib2.0-0  \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Add a non-root user for better security
RUN useradd -ms /bin/bash appuser
USER appuser
WORKDIR /workspace

###############################
# --- Stage 2: pip install ----
###############################
FROM base AS builder
COPY --chown=appuser:appuser requirements.txt setup.py README.md /workspace/
COPY --chown=appuser:appuser video/ /workspace/video
RUN pip install --no-cache-dir --user -r /workspace/requirements.txt && \
    pip install --no-cache-dir --user -e /workspace
    
#######################################
# --- Stage 3: runtime / final image --
#######################################
FROM base AS runtime
# Copy only the virtualenv site-packages from builder
COPY --from=builder /home/appuser/.local /home/appuser/.local
ENV PATH=$PATH:/home/appuser/.local/bin

# Copy application code
COPY --chown=appuser:appuser video/ /workspace/video
COPY --chown=appuser:appuser setup.py /workspace/
COPY --chown=appuser:appuser run_video.py /workspace/

# Auto-install all plugin requirements.txt (if any exist)
RUN set -e; \
    cd /workspace/video/modules; \
    find . -name "requirements.txt" | xargs cat | sort | uniq > /tmp/all-module-reqs.txt; \
    pip install --no-cache-dir --user -r /tmp/all-module-reqs.txt || true

EXPOSE 8080

# ── Runtime behaviour ───────────────────────────────────────────────────────
# By default we rely on the smart launcher in `video/__main__.py`:
#   • `docker run …`  → API server on :8080
#   • `docker run … stats` → CLI pass-through
ENTRYPOINT ["python", "-m", "video"]

# You can still override at run-time:
#   FASTAPI=0 docker run …        → forces stdlib HTTP server
#   python -m video serve --port 8888 … inside container for custom port
#
# Keep CMD empty so positional args go straight into ENTRYPOINT
CMD []