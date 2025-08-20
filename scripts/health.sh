#!/usr/bin/env bash
# health.sh - System health check for That DAM Toolbox
#
# Usage:
#   ./scripts/health.sh
#
# Example:
#   ./scripts/health.sh
#
# Performs simple curl checks for core services and resources.
set -euo pipefail

echo "=== System Health Check ==="
echo "Camera Proxy:"
curl -s http://localhost:8000/api/devices | jq '.' 2>/dev/null || echo "  ❌ Camera proxy not responding"
echo -e "\nAPI Gateway:"
curl -s http://localhost:8080/api/health | jq '.' 2>/dev/null || echo "  ❌ API gateway not responding"
echo -e "\nDocker Services:"
curl -s http://localhost:8080/health 2>/dev/null && echo "  ✅ Python API healthy" || echo "  ❌ Python API not responding"
curl -s http://localhost:3000/api/health 2>/dev/null && echo "  ✅ Next.js frontend healthy" || echo "  ❌ Next.js frontend not responding"
echo -e "\nStorage:"
df -h ${MEDIA_DIR:-/var/media/records} 2>/dev/null || echo "  ❌ Media directory not accessible"
echo -e "\nMemory:"
free -h
