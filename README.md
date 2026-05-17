# DeepFake Audio Detection

A machine learning system to detect synthetic and AI-generated audio using deep learning. This project combines CNN-based audio analysis with a web interface for easy deployment and real-world testing.

## Overview

This project addresses the growing threat of synthetic audio deepfakes by building a classifier that distinguishes between authentic and artificially generated audio. The system processes audio files as mel-spectrograms and uses a 4-block convolutional neural network trained on real and synthetic speech samples.

## Features

- **Web Interface** — Upload and test audio files directly through a browser
- **Multi-Format Support** — Accepts `.wav`, `.mp3`, `.flac`, `.ogg`, `.webm`, `.m4a` audio files
- **Real-Time Inference** — Fast CPU-based predictions with confidence scores
- **Production-Ready** — Flask backend with Gunicorn, deployable on Render or other cloud platforms
- **Robust Preprocessing** — Mel-spectrogram feature extraction matching training pipeline

## Architecture

### Model
- **CNN Architecture** — 4 convolutional blocks with batch normalization and dropout
- **Input** — Mel-spectrogram (128 bands, 4-second clips)
- **Output** — Binary classification (Real/Fake) with confidence score
- **Threshold** — 60% confidence required for "Fake" classification to reduce false positives

### Backend
- **Framework** — Flask (Python)
- **Server** — Gunicorn + Flask development server
- **Preprocessing** — librosa for audio loading and feature extraction
- **Inference** — PyTorch (CPU-only)

### Frontend
- HTML/CSS/JavaScript interface for file upload and result display
- Real-time result visualization with prediction confidence

## Setup

### Requirements
- Python 3.8+
- Dependencies listed in `requirements.txt`

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd DeepFake-Audio-Detection.-main
```

2. Create a virtual environment (recommended)
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies
```bash
pip install -r requirements.txt
```

### Running Locally

Start the Flask development server:
```bash
python app.py
```

The application will be available at `http://localhost:5000`

## Usage

### Web Interface
1. Open `http://localhost:5000` in your browser
2. Click "Choose File" and select an audio file (max 10 MB)
3. Click "Upload and Predict"
4. View the prediction result with confidence percentage

### API Endpoint

**POST `/predict`**

Upload an audio file for classification:

```bash
curl -X POST -F "file=@audio.wav" http://localhost:5000/predict
```

**Response:**
```json
{
  "prediction": "Real",
  "confidence": 92.37,
  "label": "Real"
}
```

**Error Response (invalid format):**
```json
{
  "error": "Unsupported format. Allowed: .flac, .m4a, .mp3, .ogg, .wav, .webm"
}
```

## Project Structure

```
├── app.py                      # Flask backend & routes
├── predict.py                  # CNN model & inference pipeline
├── requirements.txt            # Python dependencies
├── render.yaml                 # Render deployment config
├── models/
│   └── cnn_model.pth          # Trained PyTorch model weights
├── static/
│   ├── script.js              # Frontend JavaScript
│   └── style.css              # Frontend styling
├── templates/
│   └── index.html             # Web interface
└── notebooks/
    ├── 01_prepare_data.ipynb          # Data preparation
    ├── 02_feature_extraction.ipynb    # Mel-spectrogram generation
    ├── 03_train_lgbm.ipynb            # LightGBM baseline
    ├── 04_train_cnn.ipynb             # CNN training (primary model)
    └── 05_meta_model.ipynb            # Ensemble/meta-model
```

## Training Pipeline

The project includes Jupyter notebooks documenting the full ML pipeline:

1. **Data Preparation** (`01_prepare_data.ipynb`) — Load and organize training data
2. **Feature Extraction** (`02_feature_extraction.ipynb`) — Convert audio to mel-spectrograms
3. **Baseline Model** (`03_train_lgbm.ipynb`) — LightGBM classifier for comparison
4. **Primary Model** (`04_train_cnn.ipynb`) — CNN training and evaluation
5. **Ensemble** (`05_meta_model.ipynb`) — Meta-learner combining multiple models

## Deployment

### Render Platform

The project includes a `render.yaml` configuration for easy deployment to Render:

```bash
render deploy
```

Or manually deploy via the Render dashboard using the `render.yaml` configuration.

**Deployment Requirements:**
- Model file (`models/cnn_model.pth`) committed to repository
- Port exposed: 5000
- Python 3.8+ buildpack

## Configuration

- **Max Upload Size** — 10 MB (configurable in `app.py`)
- **Allowed Formats** — `.flac`, `.wav`, `.mp3`, `.ogg`, `.webm`, `.m4a`
- **Sample Rate** — 16 kHz
- **Duration** — 4 seconds
- **Fake Threshold** — 0.6 (60% confidence required)

## Performance

- **Inference Time** — ~1-2 seconds per audio file (CPU)
- **Model Size** — ~50 MB
- **Accuracy** — Trained on real and synthetic speech datasets

## Troubleshooting

### Model not found
Ensure `models/cnn_model.pth` exists in the project directory. The Flask server will fail to start if the model is missing.

### Audio format errors
Only formats supported by librosa are accepted. Try converting your file:
```bash
ffmpeg -i input.m4a -acodec pcm_s16le -ar 16000 output.wav
```

### Out of memory
On limited systems, close other applications or increase swap space. The model runs on CPU by default.

## Future Improvements

- GPU acceleration for faster inference
- Batch processing capabilities
- Model retraining pipeline
- Additional audio preprocessing options
- Confidence calibration for production thresholds


## Disclaimer

This tool is provided for research and educational purposes. Detection accuracy depends on the quality and diversity of training data. Always verify results with domain expertise before making critical decisions.
