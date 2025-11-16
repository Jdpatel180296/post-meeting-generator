# Multi-stage Docker build for production
# Builds client + server and packages them together

# Build stage 1: Build React frontend from local monorepo sources
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

# Build stage 2: Prepare server
FROM node:18-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
# Use npm install to support builds without a lockfile; omit dev deps for smaller image
RUN npm install --omit=dev
COPY server ./

# Final stage: Runtime
FROM node:18-alpine

WORKDIR /app/server

# Copy node_modules from server-builder
COPY --from=server-builder /app/server/node_modules ./node_modules

# Copy server files
COPY --from=server-builder /app/server ./

# Copy built client frontend to server's public directory
COPY --from=client-builder /app/client/build ./public

# Create directories if needed
RUN mkdir -p ./public ./db/migrations

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/accounts', (r) => {if (r.statusCode !== 200 && r.statusCode !== 401) throw new Error(r.statusCode)})"

# Start server (run migrations, then start)
CMD ["npm", "run", "start:prod"]
