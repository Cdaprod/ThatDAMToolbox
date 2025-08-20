# /docker/touch-display/Dockerfile
FROM python:3.11-slim
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - touch-display" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG

# Install system dependencies
RUN apt-get update && apt-get install -y \
    i2c-tools \
    wireless-tools \
    wpasupplicant \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY pi/ .

# Create necessary directories
RUN mkdir -p /var/log /tmp

# Set permissions
RUN chmod +x wifi_manager.py

# Expose API port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/status || exit 1

# Run as root (needed for network management)
USER root

# Start the application
CMD ["python3", "wifi_manager.py"]