const { ipcRenderer } = require('electron');
const path = require('path');

// Load from the package (parent directory)
const { 
  FFmpegDecoder, 
  FFmpegStreamPlayer, 
  FFmpegBufferedPlayer,
  getWorkletPath 
} = require('../lib/index.js');

// Set decoder for player classes
FFmpegStreamPlayer.setDecoder(FFmpegDecoder);
FFmpegBufferedPlayer.setDecoder(FFmpegDecoder);

// Initialize audio context at 44100 Hz (matches FFmpeg decoder output)
const audioContext = new AudioContext({ sampleRate: 44100 });

// Players
let currentPlayer = null;
let currentMode = 'stream'; // 'stream' or 'buffered'
let currentFilePath = null;
let updateInterval = null;
let isLooping = false;

// UI Elements
const selectFileBtn = document.getElementById('selectFileBtn');
const closeFileBtn = document.getElementById('closeFileBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const loopBtn = document.getElementById('loopBtn');
const modeStreamBtn = document.getElementById('modeStream');
const modeBufferedBtn = document.getElementById('modeBuffered');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const fileInfo = document.getElementById('fileInfo');
const filePathEl = document.getElementById('filePath');
const durationEl = document.getElementById('duration');
const sampleRateEl = document.getElementById('sampleRate');
const channelsEl = document.getElementById('channels');
const statusBar = document.getElementById('statusBar');

// Test buttons
const testSeekStart = document.getElementById('testSeekStart');
const testSeekMiddle = document.getElementById('testSeekMiddle');
const testSeekEnd = document.getElementById('testSeekEnd');
const testRead100ms = document.getElementById('testRead100ms');
const testRead1s = document.getElementById('testRead1s');
const testMultipleSeeks = document.getElementById('testMultipleSeeks');

// Logging
function log(message, type = 'info') {
  const logContainer = document.getElementById('logContainer');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  
  const time = new Date().toLocaleTimeString();
  const typeClass = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info';
  
  entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="${typeClass}">${message}</span>`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function showStatus(message, duration = 3000) {
  statusBar.textContent = message;
  statusBar.classList.add('show');
  setTimeout(() => statusBar.classList.remove('show'), duration);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgressBar() {
  if (!currentPlayer) return;
  
  const current = currentPlayer.getCurrentTime();
  const total = currentPlayer.getDuration();
  
  if (total > 0) {
    const percent = (current / total) * 100;
    progressBar.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(current);
    totalTimeEl.textContent = formatTime(total);
  }
}

function startProgressUpdates() {
  stopProgressUpdates();
  updateInterval = setInterval(updateProgressBar, 100);
}

function stopProgressUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

function createPlayer() {
  if (currentPlayer) {
    currentPlayer.stop();
  }
  
  if (currentMode === 'stream') {
    currentPlayer = new FFmpegStreamPlayer(audioContext);
    log('Created streaming player (AudioWorklet)', 'info');
  } else {
    currentPlayer = new FFmpegBufferedPlayer(audioContext);
    log('Created buffered player (full decode)', 'info');
  }
  
  // Apply current loop setting
  currentPlayer.setLoop(isLooping);
  
  currentPlayer.onEnded(() => {
    log('Playback finished', 'success');
    stopBtn.click();
  });
}

// File Selection
selectFileBtn.addEventListener('click', async () => {
  const filePath = await ipcRenderer.invoke('open-file-dialog');
  if (filePath) {
    openFile(filePath);
  }
});

closeFileBtn.addEventListener('click', () => {
  if (currentPlayer) {
    currentPlayer.stop();
    currentPlayer = null;
  }
  
  currentFilePath = null;
  fileInfo.style.display = 'none';
  closeFileBtn.disabled = true;
  playBtn.disabled = true;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  loopBtn.disabled = true;
  testSeekStart.disabled = true;
  testSeekMiddle.disabled = true;
  testSeekEnd.disabled = true;
  testRead100ms.disabled = true;
  testRead1s.disabled = true;
  testMultipleSeeks.disabled = true;
  
  progressBar.style.width = '0%';
  currentTimeEl.textContent = '0:00';
  totalTimeEl.textContent = '0:00';
  
  log('File closed', 'info');
});

async function openFile(filePath) {
  try {
    log(`Opening file: ${filePath}`, 'info');
    
    createPlayer();
    
    // For streaming player, initialize with worklet path from package
    if (currentMode === 'stream') {
      await currentPlayer.init(getWorkletPath());
    }
    
    // Use open() to load without playing
    const info = await currentPlayer.open(filePath);
    
    currentFilePath = filePath;
    
    // Update UI
    filePathEl.textContent = filePath;
    durationEl.textContent = `${info.duration.toFixed(2)} seconds`;
    sampleRateEl.textContent = `${info.sampleRate} Hz`;
    channelsEl.textContent = info.channels;
    totalTimeEl.textContent = formatTime(info.duration);
    
    fileInfo.style.display = 'block';
    closeFileBtn.disabled = false;
    playBtn.disabled = false;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    loopBtn.disabled = false;
    testSeekStart.disabled = false;
    testSeekMiddle.disabled = false;
    testSeekEnd.disabled = false;
    testRead100ms.disabled = false;
    testRead1s.disabled = false;
    testMultipleSeeks.disabled = false;
    
    log(`File opened successfully (${info.duration.toFixed(2)}s, ${info.sampleRate}Hz, ${info.channels}ch)`, 'success');
    showStatus('File loaded successfully');
  } catch (err) {
    log(`Error opening file: ${err.message}`, 'error');
    showStatus('Failed to open file');
  }
}

// Mode Selection
modeStreamBtn.addEventListener('click', () => {
  if (currentMode === 'stream') return;
  currentMode = 'stream';
  modeStreamBtn.classList.add('active');
  modeBufferedBtn.classList.remove('active');
  log('Switched to streaming mode', 'info');
  
  if (currentFilePath) {
    openFile(currentFilePath); // Reopen with new player
  }
});

modeBufferedBtn.addEventListener('click', () => {
  if (currentMode === 'buffered') return;
  currentMode = 'buffered';
  modeBufferedBtn.classList.add('active');
  modeStreamBtn.classList.remove('active');
  log('Switched to buffered mode', 'info');
  
  if (currentFilePath) {
    openFile(currentFilePath); // Reopen with new player
  }
});

// Playback Controls
playBtn.addEventListener('click', async () => {
  if (!currentPlayer) return;
  
  await currentPlayer.play();
  startProgressUpdates();
  log('Playback started', 'info');
});

pauseBtn.addEventListener('click', () => {
  if (!currentPlayer) return;
  
  currentPlayer.pause();
  stopProgressUpdates();
  updateProgressBar();
  log('Playback paused', 'info');
});

stopBtn.addEventListener('click', () => {
  if (!currentPlayer) return;
  
  currentPlayer.stop();
  stopProgressUpdates();
  
  // Reopen file to reset
  if (currentFilePath) {
    openFile(currentFilePath);
  }
  
  log('Playback stopped', 'info');
});

// Loop toggle
loopBtn.addEventListener('click', () => {
  isLooping = !isLooping;
  loopBtn.textContent = isLooping ? '🔁 Loop: ON' : '🔁 Loop: OFF';
  loopBtn.classList.toggle('active', isLooping);
  
  if (currentPlayer) {
    currentPlayer.setLoop(isLooping);
  }
  
  log(`Loop ${isLooping ? 'enabled' : 'disabled'}`, 'info');
});

// Progress bar seeking
progressContainer.addEventListener('click', (e) => {
  if (!currentPlayer) return;
  
  const rect = progressContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const percent = x / rect.width;
  const seekTime = percent * currentPlayer.getDuration();
  
  currentPlayer.seek(seekTime);
  updateProgressBar();
  log(`Seeked to ${formatTime(seekTime)}`, 'info');
});

// Volume Control
volumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value / 100;
  if (currentPlayer) {
    currentPlayer.volume = volume;
  }
  volumeValue.textContent = `${e.target.value}%`;
});

// Test Functions
testSeekStart.addEventListener('click', () => {
  if (!currentPlayer) return;
  currentPlayer.seek(0);
  updateProgressBar();
  log('Seeked to start (0s)', 'success');
});

testSeekMiddle.addEventListener('click', () => {
  if (!currentPlayer) return;
  const middle = currentPlayer.getDuration() / 2;
  currentPlayer.seek(middle);
  updateProgressBar();
  log(`Seeked to middle (${formatTime(middle)})`, 'success');
});

testSeekEnd.addEventListener('click', () => {
  if (!currentPlayer) return;
  const nearEnd = currentPlayer.getDuration() - 5;
  currentPlayer.seek(nearEnd);
  updateProgressBar();
  log(`Seeked to near end (${formatTime(nearEnd)})`, 'success');
});

testRead100ms.addEventListener('click', () => {
  const decoder = new FFmpegDecoder();
  if (!decoder.open(currentFilePath)) {
    log('Failed to open file for reading test', 'error');
    return;
  }
  
  const samples = Math.floor(decoder.getSampleRate() * decoder.getChannels() * 0.1);
  const start = performance.now();
  const result = decoder.read(samples);
  const elapsed = performance.now() - start;
  
  log(`Read 100ms: ${result.samplesRead} samples in ${elapsed.toFixed(2)}ms`, 'success');
  decoder.close();
});

testRead1s.addEventListener('click', () => {
  const decoder = new FFmpegDecoder();
  if (!decoder.open(currentFilePath)) {
    log('Failed to open file for reading test', 'error');
    return;
  }
  
  const samples = Math.floor(decoder.getSampleRate() * decoder.getChannels() * 1.0);
  const start = performance.now();
  const result = decoder.read(samples);
  const elapsed = performance.now() - start;
  
  log(`Read 1s: ${result.samplesRead} samples in ${elapsed.toFixed(2)}ms`, 'success');
  decoder.close();
});

testMultipleSeeks.addEventListener('click', () => {
  const decoder = new FFmpegDecoder();
  if (!decoder.open(currentFilePath)) {
    log('Failed to open file for seek test', 'error');
    return;
  }
  
  const dur = decoder.getDuration();
  const positions = [0, dur * 0.25, dur * 0.5, dur * 0.75, dur * 0.9];
  
  const start = performance.now();
  for (const pos of positions) {
    decoder.seek(pos);
    decoder.read(4410); // Read a small chunk
  }
  const elapsed = performance.now() - start;
  
  log(`Multiple seeks test: 5 seeks + reads in ${elapsed.toFixed(2)}ms`, 'success');
  decoder.close();
});

// Initialize
log('FFmpeg NAPI Interface loaded', 'success');
log(`Node.js: ${process.versions.node}, Electron: ${process.versions.electron}, Chrome: ${process.versions.chrome}`, 'info');
