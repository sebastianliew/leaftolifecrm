# syntax=docker/dockerfile:1.7

# ── Build stage ────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Enable pnpm via corepack (version comes from package.json's "packageManager")
RUN corepack enable

# Install deps (separate layer so subsequent builds cache)
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# Drop dev dependencies for the runtime stage
RUN pnpm prune --prod

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# tini for proper signal handling (SIGTERM → graceful shutdown)
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root
RUN groupadd -r app && useradd -r -g app -d /app app

# Copy built output and production deps
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app

EXPOSE 5000

# Healthcheck against the /health endpoint exposed by server.ts
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.BACKEND_PORT || process.env.PORT || 5000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
