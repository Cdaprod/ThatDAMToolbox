# syntax=docker/dockerfile:1.5
#
# Folder layout inside the image
# ┌─ /app
# │   ├─ node_modules     ← installed once during build
# │   ├─ public           ← static assets
# │   ├─ start.js         ← standalone server entrypoint (if you use it)
# │   └─ .next            ← output of `npm run build`
# └───────────────────────────────────────────────────────────────────────────

# Stage 0 ▸ Base image
FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

# Stage 1 ▸ deps
FROM base AS deps
# hadolint ignore=DL3018
RUN apk add --no-cache bash curl ca-certificates
# copy only manifests to keep cache hot when source changes
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
# explicit branching; keep line-continuations with '\'
RUN set -euo pipefail; \
  if [ -f yarn.lock ]; then \
    echo "🧶 Installing with yarn…"; \
    corepack enable yarn; \
    yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    echo "📦 Installing with npm ci…"; \
    if ! npm ci; then \
      echo "⚠️ npm ci failed – falling back to npm install"; \
      npm install; \
    fi; \
  elif [ -f pnpm-lock.yaml ]; then \
    echo "📦 Installing with pnpm…"; \
    corepack enable pnpm; \
    pnpm install --frozen-lockfile; \
  else \
    echo "⚠️ No lockfile found – running npm install"; \
    npm install; \
  fi; \
  # ensure the dir exists even if there were zero deps
  mkdir -p node_modules

# Stage 2 ▸ development
FROM base AS development
COPY --from=deps /app/node_modules /app/node_modules
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]

# Stage 3 ▸ builder
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
WORKDIR /app
COPY . .
# BuildKit cache for Next (optional but nice)
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Stage 4 ▸ production
FROM node:18-alpine AS production
WORKDIR /app