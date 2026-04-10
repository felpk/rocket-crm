FROM node:22-alpine AS base

# --- Dependencies ---
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Prisma deps (isolated install for migrations in runtime) ---
FROM base AS prisma-deps
WORKDIR /prisma-install
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && rm -rf package.json package-lock.json

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
RUN npm run build

# --- Runtime ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema, config, and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

# Copy full node_modules from prisma-deps for migration CLI (includes all transitive deps)
COPY --from=prisma-deps /prisma-install/node_modules ./node_modules_prisma
# Merge prisma deps into node_modules without overwriting standalone deps (e.g. better-sqlite3)
RUN for pkg in /app/node_modules_prisma/*; do \
      name=$(basename "$pkg"); \
      [ -e "/app/node_modules/$name" ] || cp -r "$pkg" "/app/node_modules/$name"; \
    done && \
    for scope_dir in /app/node_modules_prisma/@*; do \
      scope=$(basename "$scope_dir"); \
      mkdir -p "/app/node_modules/$scope"; \
      for pkg in "$scope_dir"/*; do \
        name=$(basename "$pkg"); \
        [ -e "/app/node_modules/$scope/$name" ] || cp -r "$pkg" "/app/node_modules/$scope/$name"; \
      done; \
    done && \
    rm -rf /app/node_modules_prisma

# Data directory for SQLite + Next.js cache + Prisma engines write access
RUN mkdir -p /app/data /app/.next/cache && \
    chown -R nextjs:nodejs /app/data /app/.next /app/node_modules/@prisma/engines

# Startup script: migrate then start
RUN printf '#!/bin/sh\nnode node_modules/prisma/build/index.js migrate deploy || echo "Migration skipped"\nnode server.js\n' > /app/start.sh && chmod +x /app/start.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["/app/start.sh"]
