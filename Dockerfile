# Backend-only Dockerfile for Railway
# - Builds and runs only the Node/Express server
# - Database connection is provided via env vars (DATABASE_URL or PG*),
#   which Railway injects when you attach the Postgres service.

# Build stage: install server dependencies
FROM node:18-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
# Use npm install to support builds without a lockfile; omit dev deps for smaller image
RUN npm install --omit=dev
COPY server ./

# Runtime stage
FROM node:18-alpine
WORKDIR /app/server

# Copy node_modules and server sources
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server ./

# Expose port
EXPOSE 4000

# Health check (allow 200 or 401 depending on session state)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/accounts', (r) => {if (r.statusCode !== 200 && r.statusCode !== 401) throw new Error(r.statusCode)})"

# Start server (run migrations, then start)
CMD ["npm", "run", "start:prod"]
