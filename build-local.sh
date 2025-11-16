#!/bin/bash
# Build and Test Deployment Locally
# This script builds your app locally to test before deploying

set -e

echo "🏗️  Building Post Meeting Generator"
echo "===================================="
echo ""

# Build client
echo "📦 Building React frontend..."
cd client
npm install
npm run build
echo "✅ Client built successfully"
echo ""

# Install server dependencies
echo "📦 Installing server dependencies..."
cd ../server
npm install
echo "✅ Server dependencies installed"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migrate
echo "✅ Migrations completed"
echo ""

# Test build
echo "🧪 Testing build..."
echo "Starting server on port 4000..."
echo "Press Ctrl+C to stop"
echo ""
NODE_ENV=production npm start
