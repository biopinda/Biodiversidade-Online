# syntax=docker/dockerfile:1.6

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

# Install only the web workspace deps and build
RUN bun install --frozen-lockfile --filter @biodiversidade/web

WORKDIR /app/packages/web
RUN bun run build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4321

# Admin authentication (set these in UNRAID Docker config)
ENV ADMIN_USERNAME=""
ENV ADMIN_PASSWORD=""

# MongoDB connection (set in UNRAID Docker config)
ENV MONGO_URI=""

# Copy runtime artifacts
COPY --from=builder /app/packages/web/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/web/dist ./dist

EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]

