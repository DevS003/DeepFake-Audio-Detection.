// ══════════════════════════════════════════════════════════════
//  TRUEFORM — script.js
// ══════════════════════════════════════════════════════════════


// ─── Element refs ──────────────────────────────────────────────
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const audioInput = document.getElementById("audioInput");
const dropArea = document.getElementById("dropArea");
const fileName = document.getElementById("fileName");
const analyzeBtn = document.getElementById("analyzeBtn");
const loading = document.getElementById("loading");
const resultBox = document.getElementById("resultBox");
const resultText = document.getElementById("resultText");
const resultSubtext = document.getElementById("resultSubtext");
const resultIcon = document.getElementById("resultIcon");
const audioPlayer = document.getElementById("audioPlayer");
const navbar = document.getElementById("navbar");
const resetBtn = document.getElementById("resetBtn");

let wavesurfer = null;
let recordedBlob = null;


// ─── Navbar scroll effect ───────────────────────────────────────
window.addEventListener("scroll", () => {
  navbar.classList.toggle("scrolled", window.scrollY > 60);
});


// ─── Theme toggle ───────────────────────────────────────────────
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light");
  themeIcon.textContent = "●";
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  themeIcon.textContent = isLight ? "●" : "○";
});


// ─── Hero Canvas — oscilloscope animation ───────────────────────
(function initCanvas() {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  let t = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const w = canvas.width;

    // Draw 3 overlapping sine wave lines — like an oscilloscope
    const waves = [
      { amp: 60, freq: 0.012, speed: 0.4, opacity: 0.6, offset: 0 },
      { amp: 35, freq: 0.020, speed: 0.7, opacity: 0.45, offset: 40 },
      { amp: 90, freq: 0.007, speed: 0.25, opacity: 0.35, offset: -20 },
    ];

    waves.forEach(wave => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(201, 169, 110, ${wave.opacity})`;
      ctx.lineWidth = 1.5;

      for (let x = 0; x <= w; x += 2) {
        const y = cy + wave.offset
          + wave.amp * Math.sin(x * wave.freq + t * wave.speed)
          + (wave.amp * 0.3) * Math.sin(x * wave.freq * 2.3 + t * wave.speed * 1.5);

        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    t += 0.04;
    requestAnimationFrame(draw);
  }

  draw();
})();


// ─── Drop Zone ──────────────────────────────────────────────────
dropArea.addEventListener("click", () => audioInput.click());

dropArea.addEventListener("dragover", e => {
  e.preventDefault();
  dropArea.classList.add("dragging");
});

dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("dragging");
});

dropArea.addEventListener("drop", e => {
  e.preventDefault();
  dropArea.classList.remove("dragging");
  const file = e.dataTransfer.files[0];
  if (file) {
    audioInput.files = e.dataTransfer.files;
    handleFileSelected(file);
  }
});

audioInput.addEventListener("change", () => {
  const file = audioInput.files[0];
  if (file) handleFileSelected(file);
});

function handleFileSelected(file) {
  fileName.textContent = file.name;

  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.classList.remove("hidden-el");

  if (wavesurfer) { wavesurfer.destroy(); wavesurfer = null; }

  wavesurfer = WaveSurfer.create({
    container: "#waveform",
    waveColor: "rgba(201,169,110,0.4)",
    progressColor: "#c9a96e",
    height: 80,
    barWidth: 2,
    barGap: 1,
    barRadius: 1,
    responsive: true,
    cursorColor: "transparent",
    backend: "WebAudio",
  });

  wavesurfer.load(url);
}


// ─── Analyze Button ─────────────────────────────────────────────
analyzeBtn.addEventListener("click", async () => {

  const file = audioInput.files[0];
  const isRecorded = fileName.textContent === "Recorded Audio Ready";

  if (!file && !isRecorded) {
    alert("Please upload an audio file first.");
    return;
  }

  const formData = new FormData();
  if (isRecorded && recordedBlob) {
    formData.append("file", recordedBlob, "recorded.wav");
  } else {
    formData.append("file", file);
  }

  // Show loader
  loading.classList.remove("hidden-el");
  resultBox.classList.add("hidden-el");

  try {
    const response = await fetch("/predict", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Hide loader
    loading.classList.add("hidden-el");

    if (data.error) {
      alert("Error: " + data.error);
      return;
    }

    showResult(data);

  } catch (err) {
    loading.classList.add("hidden-el");
    alert("Could not connect to server. Please try again.");
  }
});

function showResult(data) {
  resultBox.classList.remove("hidden-el", "is-real", "is-fake");

  if (data.label === "Real") {
    resultBox.classList.add("is-real");

    resultIcon.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
           stroke="#4ade80" stroke-width="1.5">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`;

    resultText.textContent = "Human Voice";
    resultSubtext.textContent = "This audio was classified as a genuine human recording.";

  } else {
    resultBox.classList.add("is-fake");

    resultIcon.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
           stroke="#f87171" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9"  y1="9" x2="15" y2="15"/>
      </svg>`;

    resultText.textContent = "AI Generated";
    resultSubtext.textContent = "Deepfake patterns detected in the audio signal.";
  }

  // Smooth scroll to result
  resultBox.scrollIntoView({ behavior: "smooth", block: "center" });
}


// ─── Reset Button ───────────────────────────────────────────────
resetBtn.addEventListener("click", () => {
  // Hide result
  resultBox.classList.add("hidden-el");
  resultBox.classList.remove("is-real", "is-fake");

  // Clear audio player
  audioPlayer.src = "";
  audioPlayer.classList.add("hidden-el");

  // Clear waveform
  if (wavesurfer) { wavesurfer.destroy(); wavesurfer = null; }

  // Clear file input
  audioInput.value = "";
  fileName.textContent = "";
  recordedBlob = null;

  // Scroll back to drop zone
  dropArea.scrollIntoView({ behavior: "smooth", block: "center" });
});
