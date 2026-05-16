// ================= ELEMENT SELECTION =================

const themeToggle = document.getElementById("themeToggle");

const audioInput = document.getElementById("audioInput");

const dropArea = document.getElementById("dropArea");

const fileName = document.getElementById("fileName");

const analyzeBtn = document.getElementById("analyzeBtn");

const loading = document.getElementById("loading");

const resultBox = document.getElementById("resultBox");

const resultText = document.getElementById("resultText");

const startRecord = document.getElementById("startRecord");

const stopRecord = document.getElementById("stopRecord");

const audioPlayer = document.getElementById("audioPlayer");

const recordingStatus = document.getElementById("recordingStatus");

let wavesurfer;

// Track the current file to send (either uploaded or recorded)
let currentFile = null;


// ================= DARK MODE =================

// Check local storage for saved theme
if (localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
}

// Toggle theme
themeToggle.addEventListener("click", () => {

  document.documentElement.classList.toggle("dark");

  // Save theme preference
  if (document.documentElement.classList.contains("dark")) {
    localStorage.setItem("theme", "dark");
  } else {
    localStorage.setItem("theme", "light");
  }
});


// ================= FILE INPUT =================

// Click on drop area
dropArea.addEventListener("click", () => {
  audioInput.click();
});

// File selection
audioInput.addEventListener("change", () => {

  const file = audioInput.files[0];

  if (file) {

    // Store reference for upload
    currentFile = file;

    fileName.textContent = `Selected File: ${file.name}`;

    // Create local audio URL
    const audioURL = URL.createObjectURL(file);

    // Show player
    audioPlayer.src = audioURL;

    audioPlayer.classList.remove("hidden");

    if (wavesurfer) {
      wavesurfer.destroy();
    }

    wavesurfer = WaveSurfer.create({
      container: '#waveform',
      waveColor: '#60a5fa',
      progressColor: '#2563eb',
      height: 100,
      responsive: true
    });

    wavesurfer.load(audioURL);

    // Hide previous results when a new file is selected
    resultBox.classList.add("hidden");
  }
});


// ================= DRAG AND DROP =================

// Drag over
dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();

  dropArea.classList.add("border-blue-600");
});

// Drag leave
dropArea.addEventListener("dragleave", () => {

  dropArea.classList.remove("border-blue-600");
});

// Drop file
dropArea.addEventListener("drop", (e) => {

  e.preventDefault();

  dropArea.classList.remove("border-blue-600");

  const file = e.dataTransfer.files[0];

  if (file) {

    audioInput.files = e.dataTransfer.files;

    currentFile = file;

    fileName.textContent = `Selected File: ${file.name}`;

    // Show audio preview
    const audioURL = URL.createObjectURL(file);
    audioPlayer.src = audioURL;
    audioPlayer.classList.remove("hidden");

    // Hide previous results
    resultBox.classList.add("hidden");
  }
});


// ================= ANALYZE BUTTON =================

analyzeBtn.addEventListener("click", async () => {

  // Check if we have a file to analyze
  if (!currentFile) {
    alert("Please upload or record an audio file first.");
    return;
  }

  // Show loader
  loading.classList.remove("hidden");

  // Hide previous result
  resultBox.classList.add("hidden");

  // Disable button during processing
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";

  try {
    // Build form data
    const formData = new FormData();
    formData.append("file", currentFile);

    // Send to Flask backend
    const response = await fetch("/predict", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Hide loader
    loading.classList.add("hidden");

    if (!response.ok) {
      // Server returned an error
      alert(data.error || "Something went wrong. Please try again.");
      return;
    }

    // Show result
    resultBox.classList.remove("hidden");

    resultText.textContent = data.prediction;

    document.getElementById("confidenceText").textContent =
      `Confidence Score: ${data.confidence}%`;

    // Styling based on result
    if (data.prediction === "Real") {

      resultBox.className =
        "mt-10 p-6 rounded-xl text-center bg-green-100 text-green-700";

    } else {

      resultBox.className =
        "mt-10 p-6 rounded-xl text-center bg-red-100 text-red-700";
    }

  } catch (error) {
    // Network error or server down
    loading.classList.add("hidden");
    alert("Could not connect to the server. Please make sure the backend is running.");
    console.error("Prediction error:", error);

  } finally {
    // Re-enable button
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze Audio";
  }
});


// ================= MICROPHONE RECORDING =================

let mediaRecorder;

let audioChunks = [];

/**
 * Convert a recorded audio Blob (WebM/Opus from browser) into a proper
 * WAV file (PCM 16-bit, 16 kHz, mono) that librosa can decode.
 *
 * The browser's MediaRecorder outputs WebM, not WAV.
 * librosa/soundfile can't read WebM without ffmpeg, so we decode it
 * here using the Web Audio API and re-encode as real WAV.
 */
async function convertBlobToWav(blob) {
  // 1. Decode audio data using browser's AudioContext
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // 2. Resample to 16 kHz mono (matches training pipeline exactly)
  const TARGET_SR = 16000;
  const offlineCtx = new OfflineAudioContext(
    1,                                                         // mono
    audioBuffer.duration * TARGET_SR,                           // total samples
    TARGET_SR                                                   // sample rate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();

  // 3. Get PCM float data and convert to 16-bit integers
  const pcmFloat = rendered.getChannelData(0);
  const pcm16 = new Int16Array(pcmFloat.length);
  for (let i = 0; i < pcmFloat.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // 4. Build WAV file (44-byte header + PCM data)
  const wavBuffer = new ArrayBuffer(44 + pcm16.length * 2);
  const view = new DataView(wavBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm16.length * 2, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);           // chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, 1, true);            // mono
  view.setUint32(24, TARGET_SR, true);    // sample rate
  view.setUint32(28, TARGET_SR * 2, true);// byte rate
  view.setUint16(32, 2, true);            // block align
  view.setUint16(34, 16, true);           // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, pcm16.length * 2, true);

  // PCM samples
  const output = new Int16Array(wavBuffer, 44);
  output.set(pcm16);

  audioCtx.close();
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}


// Start Recording
startRecord.addEventListener("click", async () => {

  try {

    // Ask microphone permission
    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    // Create recorder
    mediaRecorder =
      new MediaRecorder(stream);

    // Start recording
    mediaRecorder.start();


    recordingStatus.textContent =
      "Recording in progress...";


    audioChunks = [];

    // Store audio chunks
    mediaRecorder.addEventListener(
      "dataavailable",
      event => {
        audioChunks.push(event.data);
      }
    );

    // UI feedback
    startRecord.textContent = "Recording...";

    startRecord.disabled = true;

  } catch (error) {

    alert("Microphone access denied.");
  }
});


// Stop Recording
stopRecord.addEventListener("click", () => {

  if (!mediaRecorder) return;

  mediaRecorder.stop();

  recordingStatus.textContent = "Processing recording...";

  // When recording stops
  mediaRecorder.addEventListener("stop", async () => {

    // Create raw blob from recorder (WebM/Opus format)
    const rawBlob = new Blob(audioChunks, {
      type: mediaRecorder.mimeType || "audio/webm"
    });

    try {
      // Convert to proper WAV so the server can process it
      const wavBlob = await convertBlobToWav(rawBlob);

      // Create a File object for upload
      currentFile = new File([wavBlob], "recorded_audio.wav", {
        type: "audio/wav"
      });

      // Generate local URL for preview
      const audioURL = URL.createObjectURL(wavBlob);

      // Show audio preview
      audioPlayer.src = audioURL;
      audioPlayer.classList.remove("hidden");

      recordingStatus.textContent = "Recording ready for analysis.";

    } catch (err) {
      console.error("WAV conversion error:", err);
      recordingStatus.textContent = "Recording failed. Please try again.";
    }

    // Reset UI
    startRecord.textContent = "Start Recording";
    startRecord.disabled = false;

    // Show file text
    fileName.textContent = "Recorded Audio Ready";

    // Hide previous results
    resultBox.classList.add("hidden");
  });
});
