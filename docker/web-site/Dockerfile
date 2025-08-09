# /docker/web-site/Dockerfile
# Similar layout as web-app but for marketing site
FROM node:18-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile ;\
  elif [ -f package-lock.json ]; then \
        npm ci || (echo 'npm ci failed – falling back to npm install' && npm install) ;\
  elif [ -f pnpm-lock.yaml ]; then \
        corepack enable pnpm && pnpm install --frozen-lockfile ;\
  else \
        npm install ;\
  fi

FROM base AS development
COPY --from=deps /app/node_modules /app/node_modules
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/start.js ./start.js
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
USER nextjs:nodejs
EXPOSE 3000
CMD ["node", "start.js", "start"]
