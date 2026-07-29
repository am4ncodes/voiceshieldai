# Quantum Edge — VoiceShield

AI deepfake voice detector. Upload or record a voice sample, the backend analyses it with a
wav2vec2 deepfake-detection model and returns a trust score. Every analysis is stored in
Neon PostgreSQL and available via a history API. The frontend is a single-page React app
with a live backend-status monitor, accounts, plans, a sandbox card-payment checkout, and a
full marketing site (pricing, FAQ, case studies, roadmap, API docs, enterprise contact, etc).

## What's new in this build

- **Live backend status indicator** — a pill in the header pings `/api/health` every
  60s and tells you in real time whether you're hitting the real model or the offline demo
  fallback, instead of only finding out when a scan fails.
- **~25 new frontend sections/features** — animated stat counters, trust & compliance
  badges, testimonials, a VoiceShield-vs-alternatives comparison table, FAQ accordion,
  integrations strip, developer/API section with a code sample, case studies, a public
  roadmap, a live (simulated, anonymized) activity ticker, a referral program, newsletter
  signup, mobile app / browser extension teasers, a team section, an enterprise "talk to
  sales" form, a notification bell, a language selector, a cookie-notice banner, a press/
  social-proof strip, and a full multi-column footer.
- **Sandbox checkout on the pricing page** — upgrading to Pro/Business now opens a real
  card-entry flow (card number with live brand detection + Luhn validation, expiry, CVV,
  billing country/ZIP, promo code, order summary, processing animation, success screen with
  a receipt). No real payment processor is connected — see the note below.
- **Refreshed visual identity** — a layered aurora background (violet/teal/lime) replaces
  the flat radial background, with new `--accent2` / `--accent3` design tokens used across
  the new sections.
- **`/api/health`** — a new lightweight backend endpoint (DB connectivity + config check)
  that the status indicator and Render's health check both use.
- **One-command frontend deploy** — `scripts/deploy.sh` pushes the frontend to Vercel
  straight from your machine.

## Architecture

| Part | Path | Tech | Hosting (all free, no card) |
|------|------|------|--------------------|
| Frontend | `2-FRONTEND/` | React 18 + Vite | Vercel (free) |
| Backend API | `1-BACKEND/` | Flask (calls HF's hosted Inference API for wav2vec2) | Render free web service |
| Model inference | — | wav2vec2 deepfake detector | Hugging Face Inference API (free tier) |
| Database | — | Neon PostgreSQL | Neon free tier |
| Research | `Deepfake-Audio-Research/` | feature-extraction / training experiments | — |

### API contract

- `GET /api/health` — `{ "status": "online", "database": "connected"|"unreachable", "hf_token_configured": bool, "time": iso }`.
  Used by the frontend's status pill and by Render's health check.
- `POST /api/analyze` — multipart form field `audio` (mp3/wav/ogg/m4a/webm, max 16 MB).
  Returns `{ "ai": 0-100, "real": 0-100, "metrics": [[label, value], ...], "prediction", "confidence" }`
  and saves the record to the database.
- `GET /api/history?limit=50` — latest analysis records.

---

## 5-minute deploy

You need three free accounts, no card anywhere: **Neon**, **Hugging Face**, **Render**,
**Vercel**, and a **GitHub** repo (Render's free tier only deploys from a connected repo).

1. **Push this project to a GitHub repo** (skip if it's already on GitHub).
   ```bash
   git init && git add . && git commit -m "VoiceShield"
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. **Backend → Render.** [render.com](https://render.com) → **New +** → **Blueprint** →
   connect your repo. Render reads `render.yaml` and proposes a `voiceshield-api` free web
   service → **Apply**. Open the new service → **Environment** and set:
   - `DATABASE_URL` — a Neon connection string (console.neon.tech → New project → copy it)
   - `HF_API_TOKEN` — a free token from huggingface.co → Settings → Access Tokens → Read
   - `FRONTEND_ORIGIN` — leave as `*` for now, you'll tighten it in step 4
   Wait for **Live**, then copy the URL Render shows you (e.g. `https://voiceshield-api.onrender.com`).
   Open it in a browser — you should see `{"status": "online", ...}`.
3. **Frontend → Vercel.** Either:
   - **Fastest:** `cd 2-FRONTEND && npx vercel --prod` (or run `./scripts/deploy.sh` from the
     repo root and paste your Render URL when asked) — deploys straight from your machine,
     no GitHub needed for this step.
   - **Or:** vercel.com → **Add New → Project** → import the repo → set **Root Directory**
     to `2-FRONTEND` → add environment variable `VITE_API_URL` =
     `https://voiceshield-api.onrender.com/api/analyze` → **Deploy**.
4. **Lock down CORS.** Back in Render → your service → **Environment**, set
   `FRONTEND_ORIGIN` to your exact Vercel URL (no trailing slash) → save (auto-redeploys).
5. **Verify.** Open your Vercel URL — the header status pill should read **BACKEND LIVE**
   within a few seconds. Upload a WAV file; you should get a real score. Click the status
   pill any time to see a breakdown, or hit `https://<render-url>/api/history` to confirm
   the database is being written to.

That's the whole path — steps 2–5 are normally under 10 minutes total once your Neon/HF
accounts exist (Render's free build takes ~3–5 min).

> **Render free-tier note:** the service sleeps after ~15 min idle; the first request after
> sleep takes 30–60s to wake, and the Hugging Face model can cold-start too (up to ~15–20s).
> `predictor.py` retries through HF's cold start automatically. Hit the Render URL once
> before a demo to warm it up.

---

## Local development

### Backend

```bash
cd 1-BACKEND
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # set DATABASE_URL (falls back to local SQLite if unset)
                         # and HF_API_TOKEN (free token, see deploy step 2)
python app.py           # http://localhost:5000
```

### Frontend

```bash
cd 2-FRONTEND
npm install
cp .env.example .env    # VITE_API_URL defaults to http://localhost:5000/api/analyze
npm run dev              # http://localhost:5173
```

---

## Troubleshooting "Backend unreachable"

The frontend is designed to **never break** when the backend can't be reached — it falls
back to a clearly-labelled simulated result so the UI stays usable, and shows a toast the
first time this happens. The header **status pill** tells you which mode you're in at a
glance (BACKEND LIVE / DEMO MODE); click it for a live breakdown of frontend / API / model
status and a "recheck now" button.

If it says DEMO MODE and you expect a live backend, check, in order:

1. **`VITE_API_URL` is actually set** on the Vercel project (Project → Settings →
   Environment Variables) and points at `.../api/analyze` on your Render URL, then
   redeploy — env var changes don't apply to already-built deployments.
2. **The Render service is awake.** Free-tier services sleep after ~15 min idle. Open the
   Render URL directly in a browser; if it's slow to respond, that's the wake-up cold start
   — wait ~60s, then retry the scan.
3. **CORS.** `FRONTEND_ORIGIN` on Render must exactly match your Vercel URL (protocol +
   host, no trailing slash) — check the browser console for a CORS error to confirm.
4. **`DATABASE_URL` / `HF_API_TOKEN` are set** on Render → Environment. Missing
   `HF_API_TOKEN` doesn't crash the service, but `/api/analyze` will return a 500 — check
   the **Logs** tab on Render for the exact error.
5. Hit `https://<your-render-url>/api/health` directly — it reports database connectivity
   and whether `HF_API_TOKEN` is configured, which narrows down the fault fast.

### Database

Neon PostgreSQL (free tier). Tables are created automatically on first start — no
migration step needed.

> **Security note:** an earlier commit exposed a Neon `DATABASE_URL` in `1-BACKEND/.env`.
> That file has been removed, but if you forked from that history, **rotate the Neon
> database password** (console.neon.tech → Roles & Databases → Reset password) before
> going live.

---

## Google Sign-In

The "Continue with Google" button works out of the box in **demo mode** (signs you in as
a clearly-labelled demo user, stored only in `localStorage`) so the flow never errors even
without setup. To enable **real** Google Sign-In:

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   → **Create credentials → OAuth client ID → Web application**.
2. Add your Vercel URL (and `http://localhost:5173` for local dev) under **Authorized
   JavaScript origins**.
3. Copy the client ID and set `VITE_GOOGLE_CLIENT_ID` in Vercel's environment variables
   (and in `2-FRONTEND/.env` locally) → redeploy.

Once set, the real Google Identity Services button renders automatically in place of the
demo fallback — no other code changes needed.

## Payments / checkout

The pricing page's checkout modal is a fully-functional **sandbox** flow: it formats and
validates a card number (with Luhn check + brand detection), expiry, CVV and billing
address entirely in the browser, shows a processing animation, and issues a demo receipt.
**No real payment processor is connected and no card data is transmitted anywhere** — wire
the form up to Stripe Elements (or another PCI-compliant processor) with a real backend
endpoint before accepting live cards. Try promo code `SHIELD20` for 20% off in the demo.

---

**Live demo checklist:** warm up the Render backend a minute before presenting, confirm the
status pill reads BACKEND LIVE, and have a short WAV/MP3 sample ready to upload.
