# /docker/web-app/Dockerfile

########################################
# Stage 0 • Base image
########################################
FROM node:18-alpine AS base
WORKDIR /app
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
RUN if [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    elif [ -f pnpm-lock.yaml ]; then \
      corepack enable pnpm && pnpm install --frozen-lockfile; \
    else \
      echo "⚠️  No lockfile found, running npm install" && npm install; \
    fi

########################################
# Stage 2 • Development image
########################################
FROM base AS development
WORKDIR /app

# Pull in installed deps
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Expose dev port
EXPOSE 3000
CMD ["npm", "run", "dev"]

########################################
# Stage 3 • Production build
########################################
FROM base AS builder
WORKDIR /app

# Pull in deps & source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run Next.js build
RUN npm run build

########################################
# Stage 4 • Production runner
########################################
FROM node:18-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy built output & deps
COPY --from=builder /app/public      ./public
COPY --from=builder /app/.next       ./.next
COPY --from=builder /app/node_modules ./node_modules

# Switch to unprivileged user
USER nextjs:nodejs

# Expose prod port
EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]