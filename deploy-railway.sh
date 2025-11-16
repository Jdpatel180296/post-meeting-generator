#!/bin/bash
# Railway Deployment Helper Script
# This script helps you deploy to Railway

set -e

echo "🚀 Railway Deployment Helper"
echo "============================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found."
    echo ""
    echo "Install it with:"
    echo "  npm i -g @railway/cli"
    echo ""
    echo "Or use Homebrew:"
    echo "  brew install railway"
    exit 1
fi

echo "✅ Railway CLI found"
echo ""

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Not logged in to Railway. Logging in..."
    railway login
else
    echo "✅ Already logged in to Railway"
    railway whoami
fi

echo ""
echo "📦 Available deployment options:"
echo ""
echo "1. Link existing Railway project"
echo "2. Create new Railway project"
echo "3. Deploy to current linked project"
echo "4. Add PostgreSQL database"
echo "5. Set environment variables"
echo "6. Open Railway dashboard"
echo "7. View deployment logs"
echo ""
read -p "Choose an option (1-7): " choice

case $choice in
    1)
        echo ""
        echo "🔗 Linking to existing Railway project..."
        railway link
        ;;
    2)
        echo ""
        read -p "Enter project name: " project_name
        railway init "$project_name"
        echo "✅ Project created and linked"
        ;;
    3)
        echo ""
        echo "🚀 Deploying to Railway..."
        railway up
        ;;
    4)
        echo ""
        echo "🗄️  Adding PostgreSQL database..."
        railway add --database postgres
        echo "✅ PostgreSQL database added"
        echo ""
        echo "The DATABASE_URL will be automatically available in your environment"
        ;;
    5)
        echo ""
        echo "⚙️  Setting environment variables..."
        echo ""
        echo "Important variables to set:"
        echo "  - GOOGLE_CLIENT_ID"
        echo "  - GOOGLE_CLIENT_SECRET"
        echo "  - GOOGLE_REDIRECT_URI (use your Railway domain)"
        echo "  - OPENAI_API_KEY"
        echo "  - RECALL_API_KEY"
        echo "  - ASSEMBLY_API_KEY"
        echo "  - SESSION_SECRET"
        echo "  - NODE_ENV=production"
        echo ""
        echo "You can set them via Railway dashboard or CLI:"
        echo "  railway variables set KEY=VALUE"
        echo ""
        railway open
        ;;
    6)
        echo ""
        echo "🌐 Opening Railway dashboard..."
        railway open
        ;;
    7)
        echo ""
        echo "📋 Viewing deployment logs..."
        railway logs
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Done!"
