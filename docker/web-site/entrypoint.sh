#!/bin/sh
set -e
cd /app
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "Installing deps (dev)…"
  if [ -f yarn.lock ]; then
    yarn install --frozen-lockfile
  elif [ -f package-lock.json ]; then
    npm ci || npm install
  elif [ -f pnpm-lock.yaml ]; then
    corepack enable pnpm && pnpm install --frozen-lockfile
  else
    npm install
  fi
fi
exec npm run dev