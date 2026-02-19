# syntax=docker/dockerfile:1.6

# ── Stage 1: Build ──────────────────────────────────────────────────
FROM oven/bun:1.2.21 AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential \
  && ln -sf /usr/bin/python3 /usr/bin/python \
  && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests, lockfile, and shared config
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/ingest/package.json ./packages/ingest/
COPY packages/shared/package.json ./packages/shared/
COPY packages/transform/package.json ./packages/transform/
COPY packages/web/package.json packages/web/tsconfig.json packages/web/astro.config.mjs packages/web/components.json packages/web/cron-dashboard.js packages/web/README.md ./packages/web/
COPY patches ./patches
COPY packages/web/public ./packages/web/public
COPY packages/web/src ./packages/web/src
COPY packages/web/cache ./packages/web/cache
COPY docs ./docs

# Install all workspace dependencies (needed for catalog: resolution)
RUN bun install --frozen-lockfile

WORKDIR /app/packages/web
RUN bun run build

# ── Stage 2: Production dependencies only ───────────────────────────
FROM oven/bun:1.2.21-alpine AS prod-deps

WORKDIR /app

# Copy only manifests and lockfile for production install
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/ingest/package.json ./packages/ingest/
COPY packages/shared/package.json ./packages/shared/
COPY packages/transform/package.json ./packages/transform/
COPY packages/web/package.json ./packages/web/
COPY patches ./patches

# Install production-only dependencies (no devDependencies, no sharp)
RUN bun install --frozen-lockfile --production --ignore-scripts \
  && rm -rf packages/web/node_modules/sharp \
  && rm -rf node_modules/sharp \
  && rm -rf node_modules/.cache

# ── Stage 3: Runtime ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4321

# Admin authentication (set in UNRAID Docker config)
ENV ADMIN_PIN=""

# MongoDB connection (set in UNRAID Docker config)
ENV MONGO_URI=""

# Copy only production node_modules (without sharp and devDeps)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy build artifacts
COPY --from=builder /app/packages/web/package.json ./package.json
COPY --from=builder /app/packages/web/dist ./dist

EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]

