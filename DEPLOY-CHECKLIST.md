# 📋 Deployment Readiness Checklist

## ✅ Code Preparation (COMPLETED)

- [x] Added CORS configuration for production
- [x] Added static file serving for React app
- [x] Updated OAuth redirects to support production URLs
- [x] Optimized Dockerfile for production builds
- [x] Added database migration automation
- [x] Created environment variable templates
- [x] Added session security for production
- [x] Created deployment helper scripts

## 📝 Before You Deploy

### 1. Prepare API Keys

- [ ] Google OAuth Client ID & Secret
- [ ] OpenAI API Key
- [ ] Recall.ai API Key (already have: 29401cfeaa...)
- [ ] AssemblyAI API Key (already have: 4e0758f3...)
- [ ] LinkedIn OAuth (optional)
- [ ] Facebook OAuth (optional)

### 2. Generate Secrets

```bash
# Generate a secure session secret
openssl rand -base64 32
```

### 3. Choose Deployment Platform

- [ ] Railway (Recommended) - Free $5/month credit
- [ ] Render - Easy Docker deployment
- [ ] Heroku - Classic platform
- [ ] Fly.io - Modern deployment
- [ ] DigitalOcean - Production-grade

## 🚀 Deployment Steps

### Using Railway (Recommended)

1. **Install CLI**

```bash
npm i -g @railway/cli
```

2. **Login & Setup**

```bash
railway login
railway init
```

3. **Add Database**

```bash
railway add --database postgres
```

4. **Set Environment Variables**

   - Use `.env.production.example` as reference
   - Set via Railway dashboard or CLI
   - Generate random SESSION_SECRET

5. **Deploy**

```bash
railway up
```

6. **Get Your URL**

```bash
railway open
# Note your deployment URL (e.g., https://your-app.railway.app)
```

7. **Update OAuth Redirect URIs**
   - Update in Railway environment variables
   - Update in OAuth provider consoles

## 🔍 After Deployment

### Test Checklist

- [ ] App loads successfully
- [ ] Can login with Google OAuth
- [ ] Can view calendar events
- [ ] Can enable notetaker on meeting
- [ ] Bot joins meeting successfully
- [ ] Transcript appears after meeting
- [ ] Can generate social post from transcript
- [ ] Past meetings page works

### Monitoring

- [ ] Check logs: `railway logs`
- [ ] Verify database connected
- [ ] Test all OAuth providers
- [ ] Verify bot transcription working

## 🐛 Common Issues & Fixes

### OAuth "Redirect URI Mismatch"

**Fix:** Update redirect URIs in:

1. Google Cloud Console
2. Railway environment variables
3. Must use HTTPS in production

### Database Connection Error

**Fix:**

- Verify DATABASE_URL is set
- Run migrations: `railway run npm run migrate`

### CORS Errors

**Fix:**

- Set FRONTEND_URL environment variable
- Check browser console for exact error

### Build Fails

**Fix:**

- Check Railway logs for error details
- Verify all dependencies in package.json
- Ensure Node 18.x is used

## 📚 Resources

- **Quick Guide**: `DEPLOY-QUICK.md`
- **Full Guide**: `DEPLOYMENT.md`
- **Helper Script**: `./deploy-railway.sh`
- **Local Test**: `./build-local.sh`

## 🎉 Success Criteria

Your deployment is successful when:

- ✅ App is accessible at your production URL
- ✅ OAuth login works
- ✅ Meeting bot can be scheduled
- ✅ Transcripts are generated
- ✅ Social posts can be created
- ✅ No console errors

---

**Ready to deploy?** Run: `./deploy-railway.sh`
