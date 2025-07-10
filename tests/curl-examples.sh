#!/usr/bin/env bash
# Smoke-test REST endpoints with curl + jq
BASE=${BASE_URL:-http://localhost:8080}
echo "Video-API curl tour – $BASE"

function j() { jq .; }

curl -s "$BASE/health"        | j
curl -s "$BASE/stats"         | j
curl -s "$BASE/batches"       | j
curl -s "$BASE/recent?limit=5"| j
curl -s -XPOST "$BASE/search" \
     -H 'Content-Type: application/json' \
     -d '{"query":"mp4","limit":3}' | j