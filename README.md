# Quantum Edge — VoiceShield

AI deepfake voice detector. Upload or record a voice sample, the backend analyses it with a
wav2vec2 deepfake-detection model and returns a trust score. Every analysis is stored in
Neon PostgreSQL and available via a history API.

## Architecture

| Part | Path | Tech | Hosting (all free, no card) |
|------|------|------|--------------------|
| Frontend | `2-FRONTEND/` | React 18 + Vite | Vercel (free) |
| Backend API | `1-BACKEND/` | Flask (calls HF's hosted Inference API for wav2vec2) | Render free web service |
| Model inference | — | wav2vec2 deepfake detector | Hugging Face Inference API (free tier) |
| Database | — | Neon PostgreSQL | Neon free tier |
| Research | `Deepfake-Audio-Research/` | feature-extraction / training experiments | — |

### API contract

- `POST /api/analyze` — multipart form field `audio` (mp3/wav/ogg/m4a/webm, max 16 MB).
  Returns `{ "ai": 0-100, "real": 0-100, "metrics": [[label, value], ...], "prediction", "confidence" }`
  and saves the record to the database.
- `GET /api/history?limit=50` — latest analysis records.

## Local development

### Backend

```bash
cd 1-BACKEND
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env    # set DATABASE_URL (falls back to local SQLite if unset)
                         # and HF_API_TOKEN (free token, see Step 1 below)
python app.py           # http://localhost:5000
```

### Frontend

```bash
cd 2-FRONTEND
npm install
cp .env.example .env    # VITE_API_URL defaults to http://localhost:5000/api/analyze
npm run dev             # http://localhost:5173
```

## Deployment — step by step (100% free)

Do these in order. Total time: ~25 minutes. No credit card needed anywhere.

### Step 0 — Rotate the Neon password (required!)

The old password was leaked in git history.

1. Go to https://console.neon.tech → your project → **Roles & Databases**.
2. Click your role → **Reset password**.
3. Copy the new connection string from **Connection Details** (it looks like
   `postgresql://USER:NEW_PASSWORD@HOST/neondb?sslmode=require`). Keep it handy for Step 1.

### Step 1 — Get a free Hugging Face Inference API token

The backend doesn't run the model locally — it calls HF's hosted Inference API, so the
Render free tier's 512 MB RAM is enough.

1. Sign up free at https://huggingface.co (no card).
2. Avatar → **Settings** → **Access Tokens** → **New token** → role **Read** → Create.
3. Copy the token (starts `hf_...`). Keep it handy for Step 2.

### Step 2 — Deploy the backend on Render (free, no card)

1. Sign up free at https://render.com (GitHub login is fine, no card required for free
   web services).
2. **New +** → **Blueprint** → connect this repo. Render reads `render.yaml` and
   proposes a `voiceshield-api` web service on the **free** plan → **Apply**.
3. Once created, open the service → **Environment** and set:
   - `DATABASE_URL` = your Neon connection string from Step 0
   - `HF_API_TOKEN` = the token from Step 1
   - `FRONTEND_ORIGIN` = `*` (you'll tighten this in Step 4)
4. Render builds and deploys automatically (~3–5 min, watch the **Logs** tab). When it
   shows **Live**, your backend URL is shown at the top, e.g.
   `https://voiceshield-api.onrender.com`.
5. Verify: open that URL in a browser — you should see `{"status": "online", ...}`.

> ℹ️ Render's free tier sleeps after ~15 min of no traffic; the first request after
> sleep takes 30–60s to wake. The HF Inference API can also cold-start the model on its
> first call (up to ~15–20s) — `predictor.py` already retries through this automatically.
> Hit the backend URL once a minute or two before a demo/judging to warm both up.

### Step 3 — Deploy the frontend on Vercel (free)

1. Go to https://vercel.com → **Add New** → **Project** → import this repo.
2. Set **Root Directory** to `2-FRONTEND` (Vercel auto-detects Vite).
3. Under **Environment Variables** add:
   - `VITE_API_URL` = `https://voiceshield-api.onrender.com/api/analyze`
     (your Step 2 URL + `/api/analyze`)
4. Click **Deploy** and copy your Vercel URL, e.g. `https://voiceshield.vercel.app`.

### Step 4 — Lock down CORS

1. In Render → your service → **Environment**, change `FRONTEND_ORIGIN` from `*` to your
   exact Vercel URL (e.g. `https://voiceshield.vercel.app`, no trailing slash).
2. Save — Render redeploys automatically.

### Step 5 — Verify end to end

1. Open your Vercel URL, upload a WAV file or record live.
2. You should get a real score (if you see the "Backend unreachable — simulated result"
   toast, check `VITE_API_URL` and Render's **Logs** tab).
3. Open `https://voiceshield-api.onrender.com/api/history` — your analysis should be
   listed there, proving the database connection works.

### Database

Neon PostgreSQL (free tier). Tables are created automatically on first start — no
migration step needed.

> **Security note:** a previous commit exposed the Neon `DATABASE_URL` in `1-BACKEND/.env`.
> That file has been removed, but the credential lives in git history — **rotate the Neon
> database password** before going live.
