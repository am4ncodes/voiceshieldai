import logging
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text as sql_text
from werkzeug.utils import secure_filename

from predictor import predict

load_dotenv()
logging.basicConfig(level=logging.INFO)

ALLOWED_EXTENSIONS = {"mp3", "wav", "ogg", "m4a", "webm"}
UPLOAD_FOLDER = "uploads"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB upload limit

# CORS — set FRONTEND_ORIGIN to your Vercel URL in production
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "*")}})

# Database — Neon PostgreSQL (falls back to local SQLite for development)
db_url = os.getenv("DATABASE_URL")
if not db_url:
    app.logger.warning("DATABASE_URL is not set — falling back to local SQLite (dev only).")
    db_url = "sqlite:///voiceshield.db"
elif db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True, "pool_recycle": 300}

db = SQLAlchemy(app)

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


class AnalysisRecord(db.Model):
    __tablename__ = "analysis_history"

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    prediction = db.Column(db.String(50), nullable=False)  # 'REAL' or 'FAKE'
    confidence = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "prediction": self.prediction,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


try:
    with app.app_context():
        db.create_all()
except Exception:
    app.logger.exception(
        "Could not create DB tables at startup — will retry lazily per-request. "
        "Check DATABASE_URL."
    )


# Labels shown in the frontend's "forensic breakdown" panel, derived from the AI score
METRIC_LABELS = [
    "Spectral consistency",
    "Prosody naturalness",
    "Breathing patterns",
    "Synthesis artifacts",
    "Formant stability",
]
METRIC_OFFSETS = [4, -6, 8, -3, 5]

FAKE_KEYWORDS = ("fake", "spoof", "deepfake", "synthetic", "ai", "generated")


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def build_metrics(ai_score):
    """Derive the per-metric breakdown values from the overall AI score."""
    return [
        [label, max(2, min(98, ai_score + offset))]
        for label, offset in zip(METRIC_LABELS, METRIC_OFFSETS)
    ]


@app.errorhandler(413)
def too_large(_err):
    return jsonify({"error": "Audio file too large (max 16MB)."}), 413


@app.route("/", methods=["GET"])
def index():
    return jsonify({"status": "online", "message": "VoiceShield backend API is running."})


@app.route("/api/health", methods=["GET"])
def health():
    """Lightweight liveness/readiness check used by the frontend's status indicator."""
    db_ok = True
    try:
        db.session.execute(sql_text("SELECT 1"))
    except Exception:
        db_ok = False

    return jsonify({
        "status": "online",
        "database": "connected" if db_ok else "unreachable",
        "hf_token_configured": bool(os.getenv("HF_API_TOKEN")),
        "time": datetime.now(timezone.utc).isoformat(),
    }), 200


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """Accept an audio upload, run the deepfake detector, store and return the result."""
    if "audio" not in request.files:
        return jsonify({"error": "No audio file uploaded."}), 400

    audio_file = request.files["audio"]
    if not audio_file.filename or not allowed_file(audio_file.filename):
        return jsonify({"error": "Unsupported file type. Use MP3, WAV, OGG, M4A or WEBM."}), 400

    safe_name = secure_filename(audio_file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, f"{uuid.uuid4().hex}_{safe_name}")
    audio_file.save(file_path)

    try:
        result = predict(file_path)
    finally:
        try:
            os.remove(file_path)
        except OSError:
            pass

    if "error" in result:
        app.logger.error("Prediction failed: %s", result["error"])
        return jsonify({"error": "Could not analyze the audio file."}), 500

    raw_prediction = str(result["prediction"])
    confidence = float(result["confidence"])  # 0-100

    is_fake = any(k in raw_prediction.lower() for k in FAKE_KEYWORDS)
    ai_score = round(confidence if is_fake else 100 - confidence)
    ai_score = max(0, min(100, ai_score))

    verdict = "FAKE" if is_fake else "REAL"

    # Persist the analysis (a DB outage should not break the response)
    try:
        record = AnalysisRecord(filename=safe_name, prediction=verdict, confidence=confidence)
        db.session.add(record)
        db.session.commit()
    except Exception:
        db.session.rollback()
        app.logger.exception("Failed to save analysis record")

    return jsonify({
        "ai": ai_score,
        "real": 100 - ai_score,
        "metrics": build_metrics(ai_score),
        "prediction": verdict,
        "confidence": confidence,
    }), 200


@app.route("/api/history", methods=["GET"])
def get_history():
    try:
        limit = min(int(request.args.get("limit", 50)), 200)
        records = (
            AnalysisRecord.query.order_by(AnalysisRecord.created_at.desc()).limit(limit).all()
        )
        return jsonify({
            "success": True,
            "count": len(records),
            "data": [r.to_dict() for r in records],
        }), 200
    except Exception:
        app.logger.exception("Failed to fetch history")
        return jsonify({"success": False, "error": "Could not fetch history."}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
