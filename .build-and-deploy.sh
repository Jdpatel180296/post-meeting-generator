#!/bin/bash

# Production build and deployment script
# This script builds the client and prepares the server for deployment

set -e

echo "🚀 Building for production..."

# Build frontend
echo "📦 Building React frontend..."
cd client
npm install
npm run build
echo "✅ Frontend built"

# Copy build to server public dir
echo "📋 Copying build to server..."
mkdir -p ../server/public
cp -r build/* ../server/public/
echo "✅ Frontend copied to server/public"

# Install server dependencies
echo "📦 Installing server dependencies..."
cd ../server
npm install
echo "✅ Server dependencies installed"

# Run migrations (requires DB access)
echo "🗄️  Running database migrations..."
npm run migrate || echo "⚠️  Migration failed (ensure DB is accessible)"

echo ""
echo "✨ Build complete! Your app is ready to deploy."
echo ""
echo "Next steps:"
echo "  1. Set environment variables (see .env.example)"
echo "  2. Run: npm run start (from server/)"
echo "  3. Open: http://localhost:4000"
echo ""
echo "For production deployment:"
echo "  - Heroku: git push heroku main"
echo "  - AWS EC2: pm2 start 'npm run start' --name 'post-meeting-server'"
echo "  - Railway: Push to main branch (auto-deploys)"
echo "  - Docker: docker build -t app . && docker run -p 4000:4000 app"
