# syntax=docker/dockerfile:1

# ── Base ─────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps (install node_modules once) ─────────────────────────
FROM base AS deps
# hadolint ignore=DL3018
RUN apk add --no-cache bash curl ca-certificates
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./
RUN set -e; \
  if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci || npm install; \
  else npm install; \
  fi

# ── development (hot reload) ─────────────────────────────────
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]

# ── builder (creates .next/standalone) ───────────────────────
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cache next build
RUN --mount=type=cache,target=/app/.next/cache npm run build

# ── production (slim runtime) ────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# copy runtime bits
COPY --from=builder /app/.next               ./.next
COPY --from=builder /app/public              ./public
COPY --from=deps    /app/node_modules        ./node_modules
COPY --from=builder /app/package.json        ./package.json
COPY --from=builder /app/start.js            ./start.js
USER nextjs:nodejs
EXPOSE 3000
CMD ["node","start.js","start"]