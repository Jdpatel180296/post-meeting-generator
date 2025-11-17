# Backend-only Dockerfile for Railway
# - Builds and runs only the Node/Express server
# - Database connection is provided via env vars (DATABASE_URL or PG*),
#   which Railway injects when you attach the Postgres service.

# Build stage: install server dependencies
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
# Use npm install to support builds without a lockfile; omit dev deps for smaller image
RUN npm install --omit=dev
COPY server ./

# Runtime stage
FROM node:20-alpine
WORKDIR /app/server

# Copy node_modules and server sources
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server ./

# Expose port (Railway will override with PORT env var)
EXPOSE 8080

# Health check using PORT env var and /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => { if (r.statusCode !== 200) process.exit(1); r.on('data', ()=>{}); }).on('error', () => process.exit(1))"

# Start server (run migrations, then start)
CMD ["npm", "run", "start:prod"]
