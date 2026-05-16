"""
predict.py — Deepfake Audio Detection Inference Module

Contains:
  1. CNNModel       — exact architecture from 04_train_cnng.ipynb
  2. preprocess     — exact feature extraction from 02_feature_extraction.ipynb
  3. predict        — runs inference and returns prediction + confidence
"""

import os
import numpy as np
import librosa
import torch
import torch.nn as nn


# ---------------------------------------------------------------------------
# 1. CNN MODEL ARCHITECTURE  (must match 04_train_cnng.ipynb exactly)
# ---------------------------------------------------------------------------

class CNNModel(nn.Module):
    """
    4-block CNN identical to the one trained in notebook 04.
    Input:  (batch, 1, 128, T)   — single-channel mel spectrogram
    Output: (batch, 2)           — logits for [Real, Fake]
    """

    def __init__(self):
        super().__init__()

        self.features = nn.Sequential(
            # Block 1
            nn.Conv2d(1, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.2),

            # Block 2
            nn.Conv2d(32, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.2),

            # Block 3
            nn.Conv2d(64, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.3),

            # Block 4
            nn.Conv2d(128, 256, 3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.3),

            nn.AdaptiveAvgPool2d((4, 4)),
        )

        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256 * 4 * 4, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 2),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x


# ---------------------------------------------------------------------------
# 2. LOAD MODEL  (runs once at startup)
# ---------------------------------------------------------------------------

# Resolve path relative to this file so it works on any machine / Render
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "cnn_model.pth")

# Global model instance — loaded once, reused for every request
_model = None


def load_model():
    """Load the trained CNN weights into the model (CPU only)."""
    global _model

    _model = CNNModel()
    state_dict = torch.load(MODEL_PATH, map_location=torch.device("cpu"), weights_only=True)
    _model.load_state_dict(state_dict)
    _model.eval()

    print(f"[OK] CNN model loaded from {MODEL_PATH}")
    return _model


def get_model():
    """Return the cached model, loading it on first call."""
    global _model
    if _model is None:
        load_model()
    return _model


# ---------------------------------------------------------------------------
# 3. AUDIO PREPROCESSING  (must match 02_feature_extraction.ipynb exactly)
# ---------------------------------------------------------------------------

SAMPLE_RATE = 16000       # sr=16000 in notebook
DURATION    = 4           # 4 seconds
MAX_LEN     = SAMPLE_RATE * DURATION   # 64000 samples
N_MELS      = 128         # n_mels=128
FMAX        = 8000        # fmax=8000


def preprocess_audio(file_path):
    """
    Convert an audio file into a normalised mel-spectrogram tensor.

    Pipeline (identical to save_spectrogram_matrix in notebook 02):
      1. Load audio at 16 kHz
      2. Pad / truncate to 4 seconds (64 000 samples)
      3. Compute 128-band mel spectrogram (fmax=8000)
      4. Convert to log scale  (power_to_db, ref=np.max)
      5. Z-normalise  ((x − mean) / (std + 1e-6))
      6. Return as tensor  (1, 1, 128, T)
    """

    # 1. Load audio (librosa handles .flac, .wav, .mp3, .ogg, etc.)
    y, sr = librosa.load(file_path, sr=SAMPLE_RATE)

    # 2. Normalise length
    if len(y) < MAX_LEN:
        y = np.pad(y, (0, MAX_LEN - len(y)))
    else:
        y = y[:MAX_LEN]

    # 3. Mel spectrogram
    mel = librosa.feature.melspectrogram(
        y=y,
        sr=sr,
        n_mels=N_MELS,
        fmax=FMAX,
    )

    # 4. Log scale
    mel_db = librosa.power_to_db(mel, ref=np.max)

    # 5. Z-normalise
    mel_db = (mel_db - mel_db.mean()) / (mel_db.std() + 1e-6)

    # 6. Convert to PyTorch tensor — shape (1, 1, 128, T)
    tensor = torch.tensor(mel_db, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    return tensor


# ---------------------------------------------------------------------------
# 4. PREDICT
# ---------------------------------------------------------------------------

# Class labels — index 0 = Real, index 1 = Fake  (same as training)
LABELS = ["Real", "Fake"]


def predict(file_path):
    """
    Run the full inference pipeline on a single audio file.

    Uses threshold=0.6 for Fake classification, matching the
    evaluation logic in 04_train_cnng.ipynb. This means the model
    must be >60% confident to label audio as Fake, reducing
    false positives on real audio.

    Returns
    -------
    dict  { "prediction": str, "confidence": float, "label": str }
          prediction  — "Real" or "Fake"
          confidence  — probability (0–100 %) for the predicted class
          label       — same as prediction (kept for frontend compat)
    """

    model = get_model()

    # Preprocess
    tensor = preprocess_audio(file_path)

    # Inference
    with torch.no_grad():
        outputs = model(tensor)                       # (1, 2) logits
        probs   = torch.softmax(outputs, dim=1)[0]    # (2,) probabilities

    # Use threshold=0.6 for Fake class (same as notebook 04 eval)
    # probs[1] = probability of Fake
    FAKE_THRESHOLD = 0.6

    fake_prob = probs[1].item()

    if fake_prob > FAKE_THRESHOLD:
        prediction = "Fake"
        confidence_pct = round(fake_prob * 100, 2)
    else:
        prediction = "Real"
        confidence_pct = round(probs[0].item() * 100, 2)

    return {
        "prediction": prediction,
        "confidence": confidence_pct,
        "label":      prediction,
    }
