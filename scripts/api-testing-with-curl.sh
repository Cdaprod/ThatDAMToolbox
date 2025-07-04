#!/bin/bash
# Video API Testing with curl
# Usage: bash curl_examples.sh

BASE_URL="http://localhost:8080"

echo "🎬 Video API Testing with curl"
echo "================================"

# Health check
echo -e "\n📊 Health Check:"
curl -s "$BASE_URL/health" | python3 -m json.tool

# Database stats
echo -e "\n📈 Database Stats:"
curl -s "$BASE_URL/stats" | python3 -m json.tool

# List batches
echo -e "\n📦 List Batches:"
curl -s "$BASE_URL/batches" | python3 -m json.tool

# Get recent files
echo -e "\n🕐 Recent Files (limit 5):"
curl -s "$BASE_URL/recent?limit=5" | python3 -m json.tool

# Search example
echo -e "\n🔍 Search for 'mp4':"
curl -s -X POST "$BASE_URL/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "mp4", "limit": 3}' | python3 -m json.tool

# List network paths
echo -e "\n🌐 Network Paths:"
curl -s "$BASE_URL/paths" | python3 -m json.tool

# Scan directory (example)
echo -e "\n📁 Scan Directory Example:"
curl -s -X POST "$BASE_URL/scan" \
  -H "Content-Type: application/json" \
  -d '{"directory": "/path/to/videos", "recursive": true}' | python3 -m json.tool

# Create batch example
echo -e "\n📦 Create Batch Example:"
curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-batch", "paths": ["/path/to/video1.mp4", "/path/to/video2.mp4"]}' | python3 -m json.tool

# Add network path example
echo -e "\n🌐 Add Network Path Example:"
curl -s -X POST "$BASE_URL/paths" \
  -H "Content-Type: application/json" \
  -d '{"name": "media-server", "path": "/mnt/nas/videos"}' | python3 -m json.tool

# Sync iOS album example
echo -e "\n📱 Sync iOS Album Example:"
curl -s -X POST "$BASE_URL/sync_album" \
  -H "Content-Type: application/json" \
  -d '{"album": "Favorites"}' | python3 -m json.tool

# Backup example
echo -e "\n💾 Backup Example:"
curl -s -X POST "$BASE_URL/backup" \
  -H "Content-Type: application/json" \
  -d '{"source": "/path/to/source", "destination": "/path/to/backup"}' | python3 -m json.tool

echo -e "\n✅ Testing complete!"