# syntax=docker/dockerfile:1.7

# =============================================================================
# Build Arguments
# =============================================================================
ARG NODE_VERSION=20.19.4
ARG BUN_VERSION=1.2.22
ARG BUILD_TARGET=production

# =============================================================================
# Base Image with Security Updates
# =============================================================================
FROM oven/bun:${BUN_VERSION}-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    linux-headers \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S biodiversidade -u 1001

# =============================================================================
# Dependencies Stage - Install and cache dependencies
# =============================================================================
FROM base AS dependencies

WORKDIR /app

# Copy package files for efficient caching
COPY package.json bun.lock* tsconfig.base.json ./
COPY packages/web/package.json packages/web/tsconfig.json ./packages/web/
COPY packages/ingest/package.json ./packages/ingest/
COPY patches ./patches
COPY .ruler ./.ruler

# Install dependencies with frozen lockfile (including dev dependencies)
RUN bun install --frozen-lockfile

# =============================================================================
# Builder Stage - Build the application
# =============================================================================
FROM dependencies AS builder

# Copy source code
COPY packages/web/astro.config.mjs packages/web/components.json ./packages/web/
COPY packages/web/public ./packages/web/public
COPY packages/web/src ./packages/web/src

# Set build environment
ENV NODE_ENV=production
ENV ASTRO_TELEMETRY_DISABLED=1

WORKDIR /app/packages/web

# Build the application
RUN bun run build

# Verify build output
RUN ls -la dist/ && \
    test -f dist/server/entry.mjs || (echo "Build failed: entry.mjs not found" && exit 1)

# =============================================================================
# Production Runtime Stage
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S biodiversidade -u 1001

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=4321
ENV HOST=0.0.0.0

# Copy package.json for proper dependency resolution
COPY --from=builder --chown=biodiversidade:nodejs /app/packages/web/package.json ./

# Copy built application
COPY --from=builder --chown=biodiversidade:nodejs /app/packages/web/dist ./dist

# Copy production node_modules (only production dependencies)
COPY --from=dependencies --chown=biodiversidade:nodejs /app/node_modules ./node_modules

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Security: Use non-root user
USER biodiversidade

# Expose port
EXPOSE ${PORT}

# Use dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "dist/server/entry.mjs"]

# =============================================================================
# Development Stage - For local development
# =============================================================================
FROM dependencies AS development

# Install development tools
RUN apk add --no-cache git openssh-client

WORKDIR /app/packages/web

# Copy source for development
COPY packages/web ./

# Create Astro build directory and set ownership
RUN mkdir -p .astro && chown -R biodiversidade:nodejs .

# Development environment variables
ENV NODE_ENV=development
ENV ASTRO_TELEMETRY_DISABLED=1

# Expose development port
EXPOSE 4321

# Use non-root user for development
USER biodiversidade

# Development command with hot reload
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]

