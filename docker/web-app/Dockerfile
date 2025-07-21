# /docker/web-app/Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Force clean install based on package manager
RUN \
  if [ -f yarn.lock ]; then \
    yarn install --frozen-lockfile --production=false; \
  elif [ -f package-lock.json ]; then \
    # Clean install with npm - removes node_modules and reinstalls
    rm -rf node_modules package-lock.json && \
    npm install --package-lock-only && \
    npm ci --include=dev; \
  elif [ -f pnpm-lock.yaml ]; then \
    corepack enable pnpm && \
    pnpm i --frozen-lockfile; \
  else \
    echo "No lockfile found. Creating new package-lock.json" && \
    npm install; \
  fi

# Development stage
FROM base AS development
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Development command with hot reload
CMD ["npm", "run", "dev"]

# Production builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production runner
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]