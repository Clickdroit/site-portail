# ── Stage 1: Build server deps ─────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci --production

# ── Stage 2: Production ───────────────────────────────────
FROM node:20-alpine

LABEL maintainer="Clickdroit"
LABEL description="Clickdroit Portal — DevOps Dashboard"

WORKDIR /app

# Copy server
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Copy frontend static files
COPY index.html login.html 404.html ./
COPY assets/ ./assets/
COPY data/ ./data/

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

CMD ["node", "server/index.js"]
