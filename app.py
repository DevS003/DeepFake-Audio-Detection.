"""
app.py — Flask Backend for Deepfake Audio Detection

Endpoints
---------
GET  /           →  Serves the main page (templates/index.html)
POST /predict    →  Accepts audio upload, returns JSON prediction
"""

import os
import uuid
import tempfile
from flask import Flask, request, jsonify, render_template

from predict import predict, load_model


# ---------------------------------------------------------------------------
# APP SETUP
# ---------------------------------------------------------------------------

app = Flask(__name__)

# Max upload size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# Allowed audio extensions (librosa can decode all of these)
ALLOWED_EXTENSIONS = {".flac", ".wav", ".mp3", ".ogg", ".webm", ".m4a"}


def allowed_file(filename):
    """Check if the uploaded file has a supported audio extension."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Serve the main frontend page."""
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict_route():
    """
    Accept an audio file via multipart form upload.
    Run the CNN model and return the prediction as JSON.

    Expected form field: "file"

    Returns JSON:
        {
          "prediction": "Real" | "Fake",
          "confidence": 92.37,
          "label": "Real" | "Fake"
        }
    """

    # --- Validate request ---
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Please select an audio file."}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename. Please select a valid file."}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": f"Unsupported format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        }), 400

    # --- Save to temp file ---
    # We need a real file on disk because librosa.load() reads from a path
    ext = os.path.splitext(file.filename)[1].lower()
    temp_name = f"{uuid.uuid4().hex}{ext}"
    temp_path = os.path.join(tempfile.gettempdir(), temp_name)

    try:
        file.save(temp_path)

        # --- Run prediction ---
        result = predict(temp_path)

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ---------------------------------------------------------------------------
# ERROR HANDLERS
# ---------------------------------------------------------------------------

@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": "File too large. Maximum size is 10 MB."}), 413


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error. Please try again."}), 500


# ---------------------------------------------------------------------------
# STARTUP
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Pre-load model at startup so the first request is fast
    print("[*] Loading CNN model...")
    load_model()
    print("[*] Starting Flask server on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
