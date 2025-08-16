# Build video-api service image
# Usage: docker build -f docker/video-api/Dockerfile -t video-api .
# Example: docker build -f docker/video-api/Dockerfile -t video-api .
FROM python:3.11-slim
WORKDIR /app

# Install service-specific dependencies
COPY docker/video-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy video module source
COPY video /app/video

EXPOSE 8080
CMD ["python", "-m", "video.api.main"]
