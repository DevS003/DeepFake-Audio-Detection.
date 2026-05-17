// ================= ELEMENT SELECTION =================

const themeToggle = document.getElementById("themeToggle");

const audioInput = document.getElementById("audioInput");

const dropArea = document.getElementById("dropArea");

const fileName = document.getElementById("fileName");

const analyzeBtn = document.getElementById("analyzeBtn");

const loading = document.getElementById("loading");

const resultBox = document.getElementById("resultBox");

const resultText = document.getElementById("resultText");

const audioPlayer = document.getElementById("audioPlayer");

let wavesurfer;

// Track the current file to send
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
    alert("Please upload an audio file first.");
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
