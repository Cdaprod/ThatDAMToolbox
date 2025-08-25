# /docker/web-app/Dockerfile
#
# Folder layout inside the image
# ┌─ /app
# │   ├─ node_modules     ← installed once during build
# │   ├─ public           ← static assets
# │   ├─ start.js         ← standalone server entrypoint
# │   └─ .next            ← output of `npm run build`
# └───────────────────────────────────────────────────────────────────────────

# ── Stage 0 ▸ Base image ────────────────────────────────────────────────────
FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# default to dev for intermediate stages; production overrides later
ENV NODE_ENV=development

# ── Stage 1 ▸ deps (install dependencies once) ──────────────────────────────
FROM base AS deps
# hadolint ignore=DL3018
RUN apk add --no-cache bash curl ca-certificates

# copy only manifests (maximize cache)
COPY package*.json .npmrc* ./

# install dependencies with caching
RUN --mount=type=cache,target=/root/.npm \
    set -euo pipefail; \
    if [ -f yarn.lock ]; then \
      echo "🧶 Installing with yarn…"; yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      echo "📦 Installing with npm ci…"; \
      if ! npm ci --no-audit --no-fund; then \
        echo "⚠️  npm ci failed – falling back to npm install"; npm install; \
      fi; \
    elif [ -f pnpm-lock.yaml ]; then \
      echo "📦 Installing with pnpm…"; corepack enable pnpm; pnpm install --frozen-lockfile; \
    else \
      echo "⚠️  No lockfile found – running npm install"; npm install; \
    fi

# ── Stage 2 ▸ development (hot reload) ──────────────────────────────────────
# (This stage is referenced by compose/build --target=development)
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]

# ── Stage 3 ▸ builder (Next build → .next/standalone) ───────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
# cache Next build artifacts between builds
RUN --mount=type=cache,target=/app/.next/cache npm run build

# ── Stage 4 ▸ production (minimal runtime) ──────────────────────────────────
FROM node:18-alpine AS production
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - video-web" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# non-root runtime user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy runtime artifacts
COPY --from=builder /app/.next        ./.next
COPY --from=builder /app/start.js     ./start.js
# ⬅ keep custom server dependencies and helper modules available at runtime
COPY --from=builder /app/src/lib      ./src/lib
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/public       ./public

USER nextjs:nodejs
EXPOSE 3000
CMD ["node","start.js","start"]