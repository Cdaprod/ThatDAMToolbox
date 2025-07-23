# /docker/web-app/Dockerfile

########################################
# Stage 0 • Base image
########################################
FROM node:18-alpine AS base
WORKDIR /src/app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development

########################################
# Stage 1 • Install dependencies
########################################
FROM base AS deps

# libc6-compat is needed by some native modules
RUN apk add --no-cache libc6-compat

# Copy only package manifest + lockfiles
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Install strictly from lockfile
# Force install based on lockfile with graceful fallback
RUN \
  if [ -f yarn.lock ]; then \
    echo "🧶  Found yarn.lock. Installing..." && \
    yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    echo "📦  Found package-lock.json. Trying npm ci..." && \
    npm ci || (echo "⚠️  npm ci failed, falling back to npm install..." && npm install); \
  elif [ -f pnpm-lock.yaml ]; then \
    echo "📦  Found pnpm-lock.yaml. Installing with pnpm..." && \
    corepack enable pnpm && pnpm install --frozen-lockfile; \
  else \
    echo "⚠️  No lockfile found. Running npm install..." && \
    npm install; \
  fi

########################################
# Stage 2 • Development image
########################################
FROM base AS development
WORKDIR /src/app

# Pull in installed deps
COPY --from=deps /src/app/node_modules ./node_modules

# Copy source
COPY . .

# Expose dev port
EXPOSE 3000
CMD ["npm", "run", "dev"]

########################################
# Stage 3 • Production build
########################################
FROM base AS builder
WORKDIR /src/app

# Pull in deps & source
COPY --from=deps /src/app/node_modules ./node_modules
COPY . .

# Run Next.js build
RUN npm run build

########################################
# Stage 4 • Production runner
########################################
FROM node:18-alpine AS production
WORKDIR /src/app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy built output & deps
COPY --from=builder /src/app/public      ./public
COPY --from=builder /src/app/.next       ./.next
COPY --from=builder /src/app/node_modules ./node_modules

# Switch to unprivileged user
USER nextjs:nodejs

# Expose prod port
EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]