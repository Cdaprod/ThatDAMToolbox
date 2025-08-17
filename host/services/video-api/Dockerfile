# syntax=docker/dockerfile:1
# Video API service image
# Usage: docker build -f host/services/video-api/Dockerfile -t video-api .
FROM python:3.11-alpine
WORKDIR /app
RUN apk add --no-cache bash
COPY video /app/video
COPY host/services/video-api/serve /serve
RUN chmod +x /serve
EXPOSE 8080
ENTRYPOINT ["/serve"]
