# syntax=docker/dockerfile:1.7
# Dockerfile for marketing site using npm workspaces
FROM node:20-alpine AS base
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY docker/web-site/package.json docker/web-site/tsconfig.json docker/web-site/next.config.js ./docker/web-site/
COPY docker/packages/motion-lite/package.json ./docker/packages/motion-lite/
COPY docker/packages/design-system/package.json ./docker/packages/design-system/
COPY docker/packages/ui-perf/package.json ./docker/packages/ui-perf/

FROM base AS deps
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --workspaces --include-workspace-root=false

FROM deps AS builder
COPY . .
WORKDIR /repo/docker/web-site
RUN --mount=type=cache,id=next-cache,target=.next/cache \
    npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /repo/docker/web-site/.next ./.next
COPY --from=builder /repo/docker/web-site/public ./public
COPY --from=builder /repo/docker/web-site/package.json ./package.json
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --omit=dev
EXPOSE 3000
CMD ["npm","start"]
