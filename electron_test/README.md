# FFmpeg NAPI Electron Test App

Test environment for the ffmpeg-napi-interface module in a real Electron application.

## Setup

1. **Install Electron dependencies:**
   ```bash
   cd electron_test
   npm install
   ```

2. **Make sure the parent module is built:**
   ```bash
   cd ..
   npm install
   npm run build
   ```

## Running

From the `electron_test` directory:

```bash
npm start
```

Or with developer tools open:

```bash
npm run dev
```

## Features

### Playback Modes

- **Streaming Mode (AudioWorklet):** Decodes audio on-demand in chunks, minimal memory usage
- **Buffered Mode:** Decodes entire file into memory, useful for testing full file decode

### Test Functions

- **Seek Tests:** Jump to start, middle, end positions
- **Read Tests:** Measure read performance (100ms, 1s chunks)
- **Multiple Seeks:** Stress test seeking with multiple random positions

### Player Controls

- Play/Pause/Stop
- Seek by clicking progress bar
- Volume control
- Real-time progress tracking

## Testing Different Audio Formats

The app supports all formats FFmpeg can decode:

- **Standard:** MP3, FLAC, WAV, OGG, M4A, AAC, OPUS
- **Legacy:** WMA, APE, MP2, AIF/AIFF
- **Module Trackers:** MOD, XM, S3M, IT

Test files can be added to the `testfiles/` directory (if available).

## Code Structure

- `main.js` - Electron main process (window management, IPC)
- `index.html` - UI layout and styling
- `renderer.js` - Renderer process logic, integrates FFmpeg decoder
- `js/ffmpeg_player.js` - Player classes (stream and buffered)
- `js/ffmpeg-worklet-processor.js` - AudioWorklet processor for streaming

## Debugging

The console log shows:
- File operations (open, close)
- Playback events (play, pause, seek)
- Test results with timing
- Errors and warnings

Developer tools (F12 or npm run dev) provide:
- Native module loading status
- Performance profiling
- Network tab (if loading remote files)

## Common Issues

**Module not found:**
Make sure the parent directory has built the native module:
```bash
cd ..
npm run build
```

**FFmpeg DLLs not found (Windows):**
Verify `build/Release/` contains both `ffmpeg_napi.node` and FFmpeg DLLs.

**Audio not playing:**
Check the console log for errors. Verify audio file is a supported format.

## Performance Testing

The test buttons provide quick performance benchmarks:

- **Read 100ms:** Should be < 5ms for good performance
- **Read 1s:** Should be < 20ms
- **Multiple Seeks:** Tests seek + read performance across file

Monitor CPU usage during streaming playback to ensure efficient decoding.
