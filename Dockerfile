# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build deps for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install -g npm@latest && npm install

COPY . .

# Build Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standard OCI labels + Unraid-specific labels
LABEL org.opencontainers.image.title="Family Calendar" \
      org.opencontainers.image.description="Shared family calendar — aggregates iCal feeds from all family members into one wall-calendar view. Supports Google Calendar, iCloud, Outlook, and any iCal URL." \
      org.opencontainers.image.url="https://github.com/randriksen/family-calendar" \
      org.opencontainers.image.source="https://github.com/randriksen/family-calendar" \
      net.unraid.docker.webui="http://[IP]:[PORT:3000]/" \
    net.unraid.docker.icon="https://raw.githubusercontent.com/randriksen/family-calendar/main/public/icons/icon-512.png?v=2" \
      net.unraid.docker.overview="Shared family calendar that aggregates iCal feeds from all family members into one wall-calendar view. Supports Google Calendar, iCloud, Outlook, and any iCal URL. Events auto-sync on a configurable per-calendar schedule."

# Install runtime deps for better-sqlite3
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    apk add --no-cache su-exec

# Copy built output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy node_modules for native bindings (better-sqlite3)
COPY --from=builder /app/node_modules ./node_modules

# Create data directory
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

# Set data paths
ENV DATABASE_PATH=/data/calendar.db
ENV UPLOADS_PATH=/data/uploads

# Copy entrypoint and make it executable (runs as root, fixes /data perms, then drops to nextjs)
COPY docker-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r//' /entrypoint.sh && chmod +x /entrypoint.sh

USER root

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/entrypoint.sh"]
