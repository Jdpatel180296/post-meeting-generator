# 🚀 Deployment Guide

Your Post Meeting Generator is now ready for deployment! This guide covers multiple deployment options.

## 📋 Pre-Deployment Checklist

✅ **Code is deployment-ready:**

- CORS configured for production
- Static file serving enabled
- Environment variables templated
- Docker build optimized
- Database migrations automated

## 🎯 Recommended: Railway Deployment

### Why Railway?

- ✅ Free tier with $5/month credit
- ✅ Auto-detects Dockerfile
- ✅ Built-in PostgreSQL
- ✅ Auto-deploys on git push
- ✅ Easy environment variable management

### Step-by-Step Railway Deployment

#### 1. Install Railway CLI

```bash
npm i -g @railway/cli
# or
brew install railway
```

#### 2. Login to Railway

```bash
railway login
```

#### 3. Initialize Project

```bash
# Use the helper script
./deploy-railway.sh

# Or manually:
railway init
```

#### 4. Add PostgreSQL Database

```bash
railway add --database postgres
```

Railway will automatically set `DATABASE_URL` in your environment.

#### 5. Set Environment Variables

Go to your Railway dashboard or use CLI:

```bash
railway variables set NODE_ENV=production
railway variables set SESSION_SECRET=your-random-secret-here
railway variables set GOOGLE_CLIENT_ID=your-client-id
railway variables set GOOGLE_CLIENT_SECRET=your-client-secret
railway variables set OPENAI_API_KEY=your-openai-key
railway variables set RECALL_API_KEY=29401cfeaa7fea5ffff94c9ac143baf8f446098c
railway variables set ASSEMBLY_API_KEY=4e0758f3cc9949eca2288de31104eb67
```

**Important:** After deployment, Railway will give you a domain like `your-app.railway.app`. You MUST update these:

```bash
# Update OAuth redirect URIs with your Railway domain
railway variables set GOOGLE_REDIRECT_URI=https://your-app.railway.app/oauth2callback
railway variables set LINKEDIN_REDIRECT_URI=https://your-app.railway.app/api/auth/linkedin/callback
railway variables set FACEBOOK_REDIRECT_URI=https://your-app.railway.app/api/auth/facebook/callback
railway variables set FRONTEND_URL=https://your-app.railway.app
railway variables set BACKEND_URL=https://your-app.railway.app
```

#### 6. Deploy

```bash
railway up
```

#### 7. Update OAuth Settings

After deployment, update your OAuth app settings:

**Google Cloud Console** (https://console.cloud.google.com/apis/credentials):

- Add `https://your-app.railway.app/oauth2callback` to Authorized redirect URIs

**LinkedIn Developers** (https://www.linkedin.com/developers/apps):

- Add `https://your-app.railway.app/api/auth/linkedin/callback` to Redirect URLs

**Facebook Developers** (https://developers.facebook.com/apps/):

- Add `https://your-app.railway.app/api/auth/facebook/callback` to Valid OAuth Redirect URIs

#### 8. View Logs

```bash
railway logs
```

---

## 🐳 Alternative: Docker Deployment (Any Platform)

Your app has a production-ready Dockerfile. Deploy to:

### **Render** (https://render.com)

1. Create new "Web Service"
2. Connect GitHub repo
3. Select "Docker" environment
4. Add PostgreSQL database
5. Set environment variables
6. Deploy

### **Fly.io** (https://fly.io)

```bash
fly launch
fly postgres create
fly secrets set GOOGLE_CLIENT_ID=...
fly deploy
```

### **DigitalOcean App Platform**

1. Go to App Platform
2. Create app from GitHub
3. Auto-detects Dockerfile
4. Add managed PostgreSQL
5. Set environment variables
6. Deploy

---

## 🔧 Heroku Deployment (Alternative)

### Quick Deploy

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Add PostgreSQL
heroku addons:create heroku-postgresql:mini

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set GOOGLE_CLIENT_ID=your_value
# ... set all other env vars

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

---

## 🧪 Test Locally Before Deploying

```bash
# Build and test locally
./build-local.sh
```

This will:

1. Build React frontend
2. Install server dependencies
3. Run database migrations
4. Start server in production mode

---

## 📝 Environment Variables Reference

Copy from `.env.production.example` and set these in your deployment platform:

### Required

- `NODE_ENV=production`
- `DATABASE_URL` (auto-set by most platforms)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `OPENAI_API_KEY`
- `RECALL_API_KEY`
- `ASSEMBLY_API_KEY`
- `SESSION_SECRET`

### Optional

- `FRONTEND_URL` (your deployed frontend URL)
- `BACKEND_URL` (usually same as FRONTEND_URL)
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `POLL_INTERVAL_MS=60000`

---

## 🔍 Troubleshooting

### OAuth Errors

- ✅ Verify redirect URIs match in both code and OAuth provider console
- ✅ Use HTTPS in production (not HTTP)
- ✅ Update all OAuth apps with production domain

### Database Connection Issues

- ✅ Check DATABASE_URL is set
- ✅ Ensure migrations ran (`npm run migrate`)
- ✅ Verify PostgreSQL is provisioned

### Build Failures

- ✅ Check all dependencies in package.json
- ✅ Ensure Node version matches (18.x)
- ✅ Verify Dockerfile syntax

### CORS Errors

- ✅ Set FRONTEND_URL environment variable
- ✅ Check CORS configuration in server/index.js

---

## 🎉 Post-Deployment

After successful deployment:

1. ✅ Test OAuth login flow
2. ✅ Create a test meeting with bot
3. ✅ Verify transcription works
4. ✅ Test social post generation
5. ✅ Check past meetings page

---

## 📚 Helpful Commands

```bash
# Railway
railway logs              # View logs
railway open              # Open dashboard
railway status            # Check deployment status
railway variables         # List env variables

# Heroku
heroku logs --tail        # View logs
heroku ps                 # Check dyno status
heroku config             # List env variables

# Docker (local test)
docker build -t post-meeting-generator .
docker run -p 4000:4000 --env-file .env post-meeting-generator
```

---

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Heroku Docs: https://devcenter.heroku.com

Good luck with your deployment! 🚀
