# /docker/camera-agent/Dockerfile
FROM --platform=$BUILDPLATFORM python:3.10-slim
ARG TARGETPLATFORM
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - camera-agent" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG

# Avoid Python buffering so logs appear in real‐time
ENV PYTHONUNBUFFERED=1

# Install OS packages required by OpenCV and WebRTC
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      avahi-utils \
      libatlas3-base \
      libjpeg62-turbo \
      libavdevice58 \
      libavfilter7 \
      libopus0 \
      libvpx7 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python deps
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy your agent script
COPY camera_agent.py .

# Run the agent; it reads DEVICE_ID & SERVER_WS from env
CMD ["python", "camera_agent.py"]
