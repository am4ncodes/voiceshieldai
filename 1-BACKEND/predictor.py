"""Deepfake voice detection using HF's hosted Inference API.

No model is loaded in-process (no torch/transformers needed), which keeps
memory well under free-tier hosting limits (e.g. Render free 512MB).
Requires env var HF_API_TOKEN (a free Hugging Face access token, no PRO
plan needed — Settings -> Access Tokens on huggingface.co).
"""

import os
import time

import requests

MODEL_NAME = "garystafford/wav2vec2-deepfake-voice-detector"
API_URL = f"https://router.huggingface.co/hf-inference/models/{MODEL_NAME}"
MAX_BYTES = 16 * 1024 * 1024  # matches app.py's MAX_CONTENT_LENGTH


def _headers():
    token = os.getenv("HF_API_TOKEN")
    if not token:
        raise RuntimeError(
            "HF_API_TOKEN is not set. Create a free token at "
            "huggingface.co/settings/tokens and add it as an env var."
        )
    return {
        "Authorization": f"Bearer {token}",
        # Ask HF to hold the connection open and wait for a cold model to
        # finish loading rather than immediately returning 503.
        "X-Wait-For-Model": "true",
    }


def predict(audio_path, retries=2):
    """Return {'prediction': label, 'confidence': percent} or {'error': message}."""
    try:
        with open(audio_path, "rb") as f:
            data = f.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            return {"error": "Audio file too large (max 16MB)."}

        last_error = None
        for attempt in range(retries + 1):
            try:
                response = requests.post(
                    API_URL, headers=_headers(), data=data, timeout=45
                )
            except requests.exceptions.RequestException as exc:
                last_error = f"Network error calling HF Inference API: {exc}"
                if attempt < retries:
                    time.sleep(3)
                    continue
                break

            if response.status_code == 200:
                result = response.json()
                # result is typically a list of {"label": ..., "score": ...}
                if isinstance(result, list) and result:
                    best = max(result, key=lambda r: r["score"])
                    return {
                        "prediction": best["label"],
                        "confidence": round(best["score"] * 100, 2),
                    }
                return {"error": f"Unexpected response format: {result}"}

            if response.status_code == 503:
                # Model is cold-starting on HF's side; wait and retry.
                try:
                    wait = response.json().get("estimated_time", 8)
                except ValueError:
                    wait = 8
                if attempt < retries:
                    time.sleep(min(wait, 20))
                    last_error = "Model was loading, retried."
                    continue
                last_error = "Model is still loading on Hugging Face's side, try again shortly."
                break

            if response.status_code == 429:
                last_error = "Hugging Face free-tier rate limit hit. Wait a moment and retry."
                break

            last_error = f"HF API error {response.status_code}: {response.text[:200]}"
            break

        return {"error": last_error or "Prediction failed after retries."}
    except Exception as exc:  # noqa: BLE001 — surfaced to caller, logged there
        return {"error": str(exc)}
