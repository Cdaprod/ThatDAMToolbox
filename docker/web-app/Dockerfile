# Dockerfile for the web-app service
# Usage: docker build -t thatdamtoolbox-web-app .

# Stage 0 ▸ Base
FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Stage 1 ▸ deps
FROM base AS deps
RUN apk add --no-cache bash curl ca-certificates
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
# Install deps for THIS package (not relying on hoisted root)
RUN set -eux; \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --no-audit --no-fund || npm install; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else npm install; \
  fi

# Stage 2 ▸ builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build Next.js (produces .next/standalone thanks to next.config.js)
RUN --mount=type=cache,target=/app/.next/cache npm run build

# Stage 3 ▸ production
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
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy runtime artifacts
COPY --from=builder /app/.next                 ./.next
COPY --from=builder /app/public                ./public
COPY --from=builder /app/start.js              ./start.js
# ⬅️ These were missing: your custom imports live in /src
COPY --from=builder /app/src/lib               ./src/lib
# Keep full node_modules because start.js requires code outside standalone
COPY --from=deps    /app/node_modules          ./node_modules

USER nextjs:nodejs
EXPOSE 3000
CMD ["node","start.js","start"]
