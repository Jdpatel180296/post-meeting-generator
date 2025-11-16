# 🚀 Quick Deployment Reference Card

## ⚡ Fastest Way to Deploy (Railway)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login & Initialize
railway login
railway init

# 3. Add Database
railway add --database postgres

# 4. Set Environment Variables
railway variables set NODE_ENV=production
railway variables set SESSION_SECRET=$(openssl rand -base64 32)
railway variables set GOOGLE_CLIENT_ID=your_value
railway variables set GOOGLE_CLIENT_SECRET=your_value
railway variables set OPENAI_API_KEY=your_value
railway variables set RECALL_API_KEY=29401cfeaa7fea5ffff94c9ac143baf8f446098c
railway variables set ASSEMBLY_API_KEY=4e0758f3cc9949eca2288de31104eb67

# 5. Deploy
railway up

# 6. Get your URL and update OAuth redirects
railway open
```

## 📝 After First Deploy

1. **Get your Railway URL** (e.g., `https://your-app.railway.app`)

2. **Update these environment variables:**

```bash
railway variables set GOOGLE_REDIRECT_URI=https://your-app.railway.app/oauth2callback
railway variables set FRONTEND_URL=https://your-app.railway.app
railway variables set BACKEND_URL=https://your-app.railway.app
```

3. **Update OAuth Provider Settings:**
   - Google Console: Add `https://your-app.railway.app/oauth2callback`
   - LinkedIn: Add `https://your-app.railway.app/api/auth/linkedin/callback`
   - Facebook: Add `https://your-app.railway.app/api/auth/facebook/callback`

## 🔍 Essential Commands

```bash
railway logs              # View real-time logs
railway status            # Check deployment status
railway open              # Open dashboard
railway variables         # List environment variables
railway link              # Link to existing project
```

## ✅ Files Ready for Deployment

- ✅ `Dockerfile` - Production build configuration
- ✅ `railway.json` - Railway-specific config
- ✅ `.env.production.example` - Environment variable template
- ✅ `deploy-railway.sh` - Interactive deployment script
- ✅ `DEPLOYMENT.md` - Complete deployment guide

## 🆘 Need Help?

Run the interactive helper:

```bash
./deploy-railway.sh
```

Or read the full guide:

```bash
cat DEPLOYMENT.md
```
