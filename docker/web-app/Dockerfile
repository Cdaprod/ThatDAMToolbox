# /docker/web-app/Dockerfile
#
# Folder layout inside the image
# ┌─ /app
# │   ├─ node_modules     ← installed once during build
# │   └─ src/             ← your application source (bind-mount in dev)
# └───────────────────────────────────────────────────────────────────────────

##############################################################################
# Stage 0 ▸ Base image (common for all other stages)
##############################################################################
FROM node:18-alpine AS base
# Everything below /app
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

##############################################################################
# Stage 1 ▸ Install dependencies only once
##############################################################################
FROM base AS deps

# native addons sometimes need this
RUN apk add --no-cache libc6-compat

# copy only manifest / lock-files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# install *strictly* from whichever lock-file is present
RUN \
  if [ -f yarn.lock ]; then \
        echo "🧶  Installing with yarn…" && yarn install --frozen-lockfile ;\
  elif [ -f package-lock.json ]; then \
        echo "📦  Installing with npm ci…" && npm ci \
     || (echo '⚠️  npm ci failed – falling back to npm install' && npm install) ;\
  elif [ -f pnpm-lock.yaml ]; then \
        echo "📦  Installing with pnpm…" && corepack enable pnpm && pnpm install --frozen-lockfile ;\
  else \
        echo '⚠️  No lockfile found – running npm install' && npm install ;\
  fi

##############################################################################
# Stage 2 ▸ Development image  (hot-reload, bind-mount source)
##############################################################################
FROM base AS development
# keep runtime deps in /app/node_modules
COPY --from=deps /app/node_modules /app/node_modules

# source lives in a dedicated folder that we will bind-mount
WORKDIR /app
COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]

##############################################################################
# Stage 3 ▸ Build the production artefacts
##############################################################################
FROM base AS builder
# bring in deps + source
COPY --from=deps /app/node_modules /app/node_modules
WORKDIR /app/src
COPY . .

# generate static /.next output (respect NEXT_PUBLIC_* env vars at build time)
RUN npm run build

##############################################################################
# Stage 4 ▸ Lightweight runtime image
##############################################################################
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# non-root user for safety
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nextjs

# copy build artefacts + runtime deps
COPY --from=builder /app/src/public   ./public
COPY --from=builder /app/src/.next    ./.next
COPY --from=builder /app/src/start.js            ./start.js
COPY --from=builder /app/src/lib/serviceUp.js
COPY --from=deps    /app/node_modules ./node_modules

USER nextjs:nodejs
EXPOSE 3000

# Next 14 standalone server (inside .next) works out of the box
CMD ["node", "start.js", "start"]