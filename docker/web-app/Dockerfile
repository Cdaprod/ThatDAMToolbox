# syntax=docker/dockerfile:1.7
# Dockerfile for web-app using npm workspaces
FROM node:20-alpine AS base
WORKDIR /repo

# copy workspace manifests
COPY package.json package-lock.json tsconfig.base.json ./
COPY docker/web-app/package.json docker/web-app/tsconfig.json docker/web-app/next.config.js docker/web-app/postcss.config.js docker/web-app/tailwind.config.js ./docker/web-app/
COPY docker/packages/ui-perf/package.json ./docker/packages/ui-perf/
COPY docker/packages/stream-registry/package.json ./docker/packages/stream-registry/

FROM base AS deps
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --workspaces --include-workspace-root=false

FROM deps AS builder
COPY . .
WORKDIR /repo/docker/web-app
RUN --mount=type=cache,id=next-cache,target=.next/cache \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/docker/web-app/.next ./.next
COPY --from=builder /repo/docker/web-app/public ./public
COPY --from=builder /repo/docker/web-app/package.json ./package.json
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --omit=dev
EXPOSE 3000
CMD ["npm","start"]
