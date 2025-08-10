# ─────────────────────────────────────────────────────────────────────────────
# Base
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Keep base neutral. We'll set NODE_ENV per stage.

# ─────────────────────────────────────────────────────────────────────────────
# Deps: install node_modules with cache, regardless of lock manager
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps
ENV NODE_ENV=development
RUN apk add --no-cache libc6-compat
# Only copy the manifests so cache stays warm when src changes
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# BuildKit cache paths per tool
# - npm:     /root/.npm
# - yarn:    /usr/local/share/.cache/yarn
# - pnpm:    /pnpm-store
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    --mount=type=cache,target=/pnpm-store \
    sh -ceu '
      if [ -f yarn.lock ]; then
        corepack enable yarn
        yarn install --frozen-lockfile
      elif [ -f package-lock.json ]; then
        npm ci || (echo "npm ci failed – falling back to npm install" && npm install)
      elif [ -f pnpm-lock.yaml ]; then
        corepack enable pnpm
        pnpm install --frozen-lockfile
      else
        npm install
      fi
      # prove node_modules exists (avoids COPY --from=deps not found)
      test -d node_modules
    '

# ─────────────────────────────────────────────────────────────────────────────
# Development: hot reload server
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
# Prime node_modules from deps
COPY --from=deps /app/node_modules ./node_modules
# Now bring the rest of the source
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────────────────────────────────────────
# Builder: Next.js build → standalone output
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production
# Use installed deps from deps stage to speed up build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Optional: cache .next
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# Next.js "standalone" includes the minimal server and deps
# See: .next/standalone, .next/static, public
# Ensure your next.config has `output: "standalone"` or use Next default server

# ─────────────────────────────────────────────────────────────────────────────
# Production runtime: minimal image using standalone server
# ─────────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

# Copy standalone runtime + static assets
# If you use output: "standalone", Next puts server entry at .next/standalone/server.js
COPY --from=builder /app/.next/standalone ./         # includes minimal node_modules
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs:nodejs
EXPOSE 3000

# Default server entry for standalone is server.js in the root of the copied tree
# If your entry differs, adjust this CMD accordingly (e.g., "node server.js")
CMD ["node", "server.js"]