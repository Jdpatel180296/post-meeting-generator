# Post-Meeting Generator

**Automated meeting notetaker with AI-generated social media posts and follow-up emails.**

A full-stack application that links Google Calendar accounts, automatically transcribes meetings (via Recall.ai or AssemblyAI), and generates professional social posts + follow-up emails using OpenAI.

---

## Features

- **Google Calendar OAuth**: Connect multiple Google accounts to sync upcoming events.
- **Meeting Notetaker**: Toggle notetaker for any event; automatically join Zoom/Teams/Meet via Recall.ai bot.
- **AI Transcription**: Fetch transcripts from Recall.ai or upload audio to AssemblyAI.
- **Social Post Generation**: Generate LinkedIn/Facebook posts from meeting transcripts with customizable prompts.
- **Follow-up Emails**: AI-generated recap emails from transcript content.
- **Social OAuth**: Connect LinkedIn and Facebook accounts for post publishing (OAuth flows implemented).
- **Automations**: Create platform-specific post templates with custom AI prompts.
- **Past Meetings UI**: Browse transcripts, view attendees, and platform icons; copy or publish posts directly.

---

## Tech Stack

### Client

- **React** 19 with React Router for SPA routing
- **React Testing Library** + Jest for component tests
- **Fetch API** with `credentials: 'include'` for session-backed requests

### Server

- **Node.js** + **Express** 5 (trust proxy for Railway/Render)
- **express-session** with per-session user identity (bound to Google OAuth email)
- **PostgreSQL** via **Knex** for schema migrations and queries
- **googleapis** for Google Calendar OAuth + events
- **axios** for LinkedIn/Facebook OAuth and Recall.ai/AssemblyAI integration
- **OpenAI** GPT for social post + email generation
- **Jest** + **supertest** for API endpoint tests

### Infrastructure

- **Railway** for backend deployment (Docker container with health checks)
- **CORS** allowlist via env; SameSite=None cookies for cross-domain sessions
- **Docker** multi-stage build (Node 20-alpine base image)

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (LTS)
- **PostgreSQL** 14+ (local or hosted)
- **Google Cloud** OAuth credentials (Client ID + Secret)
- **OpenAI** API key
- **Recall.ai** API key (for meeting bot scheduling)
- **(Optional)** AssemblyAI API key for audio transcription fallback
- **(Optional)** LinkedIn & Facebook OAuth app credentials

### Environment Variables

Create a `server/.env` file:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/oauth2callback

# Recall.ai (meeting bot)
RECALL_API_KEY=your_recall_api_key

# OpenAI (GPT post generation)
OPENAI_API_KEY=sk-...

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=your_pg_user
PGPASSWORD=your_pg_password
PGDATABASE=postmeeting

# Session secret
SESSION_SECRET=random-secret-string

# CORS (comma-separated if multiple)
ALLOWED_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# LinkedIn OAuth (optional)
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:4000/api/auth/linkedin/callback

# Facebook OAuth (optional)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:4000/api/auth/facebook/callback

# AssemblyAI (optional)
ASSEMBLY_API_KEY=your_assembly_api_key

# Polling interval for Recall bot status (ms)
POLL_INTERVAL_MS=60000
```

Create a `client/.env` (if deploying separately):

```bash
REACT_APP_API_BASE=http://localhost:4000
```

---

## Installation & Development

### 1. Install dependencies

**Server**:

```bash
cd server
npm install
```

**Client**:

```bash
cd client
npm install
```

### 2. Database setup

Run Postgres migrations:

```bash
cd server
npm run migrate
```

Rollback (if needed):

```bash
npm run migrate:rollback
```

### 3. Start the servers

**Backend** (port 4000 by default):

```bash
cd server
npm run dev
```

**Frontend** (port 3000 by default):

```bash
cd client
npm start
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing

### Client tests (React Testing Library + Jest)

Run all client tests:

```bash
cd client
npm test
```

**Coverage**:

- `PastMeetingsPage.test.jsx`: Verifies rendering of meeting cards with platform icons, attendees, and transcript status.
- `MeetingDetailPage.test.jsx`: Tests Copy button clipboard interaction and Publish button API call.

Mock `apiFetch` by placing mocks in `client/src/__mocks__/` or using inline `jest.mock()` in test files.

### Server tests (Jest + supertest)

Run all server tests:

```bash
cd server
npm test
```

**Coverage**:

- `api.test.js`: Validates `/health` endpoint and `/api/past-meetings` shape.
- Supertest hits exported Express `app` without requiring a live network port (module.exports = app).

**DB considerations**: Tests may fail if Postgres is not running; add `beforeAll`/`afterAll` hooks to seed/teardown test data as needed.

---

## Deployment

### Railway (backend)

1. Push to GitHub (main branch).
2. Connect Railway to your repo; set build command: `docker build`.
3. Add env vars in Railway dashboard (all `GOOGLE_*`, `OPENAI_*`, `DATABASE_URL`, etc.).
4. Railway auto-injects `PORT` and `DATABASE_URL` (Postgres addon).
5. Health check: `/health` endpoint; Railway config in `railway.json`.

**Dockerfile** uses `node:20-alpine`, multi-stage build, and health check via `HEALTHCHECK` directive.

### Client (static hosting or Railway)

**Option A**: Build static files and deploy to Vercel/Netlify:

```bash
cd client
npm run build
# Upload `build/` folder
```

**Option B**: Serve from backend (monolith):

- Copy `client/build/` to `server/public/`
- Backend serves static files and SPA fallback for client-side routing

Set `REACT_APP_API_BASE` to your backend's public domain (e.g., `https://your-app.railway.app`).

---

## Project Structure

```
post-meeting-generator/
├─ client/                      # React frontend
│  ├─ src/
│  │  ├─ pages/                 # Page components (LoginPage, EventsPage, PastMeetingsPage, etc.)
│  │  ├─ utils/                 # apiFetch helper
│  │  ├─ __tests__/             # React Testing Library specs
│  │  └─ App.jsx                # Router + nav
│  ├─ public/
│  └─ package.json
│
├─ server/                      # Express backend
│  ├─ db/
│  │  ├─ index.js               # Knex query wrappers
│  │  ├─ knexfile.js            # Knex config (dev + prod)
│  │  └─ migrations/            # SQL schema migrations
│  ├─ utils/
│  │  ├─ assemblyClient.js      # AssemblyAI transcription
│  │  ├─ aiClient.js            # OpenAI GPT post generation
│  │  └─ extractPlatform.js     # Parse Zoom/Teams/Meet links
│  ├─ scripts/
│  │  └─ waitForDb.js           # Wait for Postgres before migrations (Railway startup)
│  ├─ __tests__/
│  │  └─ api.test.js            # Supertest endpoint tests
│  ├─ index.js                  # Express app + routes
│  ├─ poller.js                 # Recall bot status polling
│  ├─ poller-runner.js          # Standalone poller runner
│  ├─ recallClient.js           # Axios client for Recall.ai
│  ├─ jest.config.js            # Jest config for server tests
│  └─ package.json
│
├─ Dockerfile                   # Multi-stage build for Railway
├─ railway.json                 # Railway healthcheck config
└─ README.md                    # This file
```

---

## Key API Endpoints

| Method | Endpoint                       | Description                                  |
| ------ | ------------------------------ | -------------------------------------------- |
| GET    | `/health`                      | Health check (uptime)                        |
| GET    | `/auth/url`                    | Google OAuth URL                             |
| GET    | `/oauth2callback`              | Google OAuth callback (sets session userKey) |
| GET    | `/api/accounts`                | List linked Google accounts (per-session)    |
| GET    | `/api/events`                  | Upcoming calendar events (24h–2mo window)    |
| GET    | `/api/past-meetings`           | Past meetings with transcripts + attendees   |
| GET    | `/api/meetings/:id`            | Meeting detail (transcript, media)           |
| POST   | `/api/meetings`                | Create/update meeting record                 |
| POST   | `/api/schedule-recall-bot`     | Schedule Recall bot for meeting              |
| POST   | `/api/generate-post`           | Generate social post from transcript         |
| POST   | `/api/generate-followup-email` | Generate follow-up email from transcript     |
| POST   | `/api/posts/:id/publish`       | Publish draft post (marks as published)      |
| GET    | `/api/social-accounts`         | User's connected LinkedIn/Facebook accounts  |
| POST   | `/api/auth/linkedin`           | LinkedIn OAuth start                         |
| POST   | `/api/auth/facebook`           | Facebook OAuth start                         |
| GET    | `/api/automations`             | List user's post automations                 |
| POST   | `/api/automations`             | Create new automation with custom prompt     |
| DELETE | `/api/automations/:id`         | Delete automation                            |
| GET    | `/api/settings`                | Get user settings (join lead time, etc.)     |
| POST   | `/api/settings`                | Update user settings                         |

---

## Session Isolation & Security

- **Per-session userKey**: Each session gets a unique key (anonymous until OAuth); after Google login, `req.session.userKey` = user's email.
- **SameSite=None; Secure**: Cookies are cross-site compatible (for separate frontend/backend domains) and require HTTPS in production.
- **trust proxy**: Express trusts `X-Forwarded-Proto` header from Railway/Render reverse proxy.
- **CORS allowlist**: Dynamic origin check via `ALLOWED_ORIGINS` env; `Vary: Origin` header for caching.
- **saveUninitialized=false**: Sessions are only created when data is stored (prevents spurious sessions).

---

## Google OAuth Test Users

If your Google OAuth app is in "Testing" mode:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → OAuth consent screen.
2. Add test users (e.g., `webshookeng@gmail.com`).
3. Add authorized redirect URIs in Credentials → OAuth 2.0 Client IDs (e.g., `http://localhost:4000/oauth2callback` for local, `https://your-backend.railway.app/oauth2callback` for prod).

---

## Troubleshooting

### CORS errors

- Ensure `ALLOWED_ORIGINS` includes the frontend URL (no trailing slash).
- Check browser console for actual origin sent vs. allowlist.
- Verify `credentials: 'include'` is set in all client fetch calls.

### 502 / health check failures

- Railway: Ensure `/health` endpoint is reachable and returns 200.
- Check Dockerfile `HEALTHCHECK` uses correct `PORT` env var.
- Server must bind to `0.0.0.0` (not `localhost`) for external access.

### Events not showing for today

- Backend uses `timeMin = now - 24h` to cover timezone skew.
- Google Calendar API requires `singleEvents=true` and `orderBy=startTime`.

### Session leaking across users

- Verify `getUserKey(req)` is used everywhere (not a hardcoded demo user).
- Check `req.session.userKey` is set in OAuth callback.
- Clear cookies and test with two separate browsers/devices.

### DB migration failures

- Run `npm run migrate` from `server/` folder.
- Check `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` env vars.
- Ensure Postgres is running and accessible.

---

## Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/my-feature`.
3. Write tests for new features (client: RTL; server: supertest).
4. Run tests: `npm test` in both `client/` and `server/`.
5. Commit: `git commit -m "feat: add awesome feature"`.
6. Push and open a PR.

---

## License

MIT

---

## Acknowledgments

- **Recall.ai** for meeting bot API
- **AssemblyAI** for transcription fallback
- **OpenAI** for GPT-powered content generation
- **Railway** for seamless Docker deployment
