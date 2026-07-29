#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# VoiceShield — fastest path to a live deployment.
#
# The FRONTEND can go live in under a minute with this script (Vercel
# CLI deploys straight from your machine — no GitHub repo required).
#
# The BACKEND (Flask + Neon + Hugging Face) is deployed on Render's
# free tier, which only supports deploying from a connected GitHub /
# GitLab repo (no CLI-only path on the free plan). See README.md
# "5-minute deploy" for the 4 clicks that takes.
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
# ──────────────────────────────────────────────────────────────────
set -e

echo "▶ VoiceShield deploy helper"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "✗ Node.js / npx not found. Install Node 18+ first: https://nodejs.org"
  exit 1
fi

read -rp "Backend API URL already deployed on Render? (e.g. https://voiceshield-api.onrender.com/api/analyze) — leave blank to skip: " API_URL

cd "$(dirname "$0")/../2-FRONTEND"

if [ -n "$API_URL" ]; then
  echo "VITE_API_URL=$API_URL" > .env.production.local
  echo "✓ Wrote .env.production.local"
fi

echo ""
echo "▶ Deploying frontend to Vercel (first run will ask you to log in)…"
npx vercel --prod

echo ""
echo "✓ Done. If you skipped the API URL above, set VITE_API_URL in the"
echo "  Vercel project's Environment Variables and redeploy — see README.md."
