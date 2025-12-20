# FFmpeg NAPI Interface

Native Node.js addon providing direct access to FFmpeg libraries for high-performance audio decoding. Supports instant seeking, streaming playback, and all audio formats FFmpeg can handle.

## Features

- ✅ **Universal Format Support** - Decode any audio format FFmpeg supports (MP3, FLAC, WAV, OGG, M4A, MOD, XM, S3M, IT, etc.)
- ✅ **Instant Seeking** - Jump to any position in milliseconds
- ✅ **Streaming Decoding** - Read audio in chunks for real-time playback
- ✅ **High Quality Output** - Float32 stereo @ 44.1kHz (auto-resampled)
- ✅ **Zero Dependencies** - No FFmpeg CLI required, uses shared libraries
- ✅ **Cross-Platform** - Windows, Linux (x64, ARM64)
- ✅ **Electron Ready** - Perfect for desktop audio applications

## Installation

### From npm (Recommended)

```bash
npm install ffmpeg-napi-interface
```

Pre-built binaries are included for:
- Windows x64
- Linux x64
- Linux ARM64

### From Source

```bash
git clone https://github.com/herrbasan/ffmpeg-napi-interface.git
cd ffmpeg-napi-interface
npm install
npm run build
```

See [BUILD.md](docs/BUILD.md) for detailed build instructions.

## Quick Start

### Basic Usage

```javascript
const { FFmpegDecoder } = require('ffmpeg-napi-interface');

const decoder = new FFmpegDecoder();

// Open an audio file
if (!decoder.open('music.mp3')) {
    console.error('Failed to open file');
    process.exit(1);
}

// Get metadata
console.log(`Duration: ${decoder.getDuration()}s`);
console.log(`Sample Rate: ${decoder.getSampleRate()} Hz`);
console.log(`Channels: ${decoder.getChannels()}`);

// Read 1 second of audio
const samplesPerSecond = decoder.getSampleRate() * decoder.getChannels();
const result = decoder.read(samplesPerSecond);

console.log(`Read ${result.samplesRead} samples`);
console.log(result.buffer); // Float32Array with audio data

// Seek to 30 seconds
decoder.seek(30.0);

// Read more audio from new position
const result2 = decoder.read(samplesPerSecond);

// Clean up
decoder.close();
```

### Streaming Playback Pattern

```javascript
const { FFmpegDecoder } = require('ffmpeg-napi-interface');

class AudioStreamer {
    constructor(filePath) {
        this.decoder = new FFmpegDecoder();
        if (!this.decoder.open(filePath)) {
            throw new Error('Failed to open file');
        }
        
        this.sampleRate = this.decoder.getSampleRate();
        this.channels = this.decoder.getChannels();
        this.position = 0;
    }
    
    // Read next chunk of audio
    readChunk(durationSeconds = 0.1) {
        const samples = Math.floor(this.sampleRate * this.channels * durationSeconds);
        const result = this.decoder.read(samples);
        
        if (result.samplesRead > 0) {
            this.position += result.samplesRead / (this.sampleRate * this.channels);
            return result.buffer; // Float32Array
        }
        
        return null; // End of file
    }
    
    // Seek to position
    seekTo(seconds) {
        this.decoder.seek(seconds);
        this.position = seconds;
    }
    
    // Get current position
    getCurrentPosition() {
        return this.position;
    }
    
    close() {
        this.decoder.close();
    }
}

// Usage
const streamer = new AudioStreamer('music.flac');

// Read 100ms chunks
while (true) {
    const chunk = streamer.readChunk(0.1);
    if (!chunk) break;
    
    // Send to audio output (Web Audio API, speaker package, etc.)
    processAudio(chunk);
}

streamer.close();
```

## Electron Integration

Perfect for desktop audio players using Electron + Web Audio API:

```javascript
// In your Electron main process or renderer
const { FFmpegDecoder } = require('ffmpeg-napi-interface');

class ElectronAudioPlayer {
    constructor() {
        this.decoder = null;
        this.audioContext = new AudioContext({ sampleRate: 44100 });
        this.nextStartTime = 0;
    }
    
    async loadFile(filePath) {
        // Open file with decoder
        this.decoder = new FFmpegDecoder();
        if (!this.decoder.open(filePath)) {
            throw new Error('Failed to open audio file');
        }
        
        return {
            duration: this.decoder.getDuration(),
            sampleRate: this.decoder.getSampleRate(),
            channels: this.decoder.getChannels()
        };
    }
    
    // Stream audio to Web Audio API
    startPlayback() {
        this.nextStartTime = this.audioContext.currentTime;
        this.scheduleNextChunk();
    }
    
    scheduleNextChunk() {
        if (!this.decoder) return;
        
        // Read 0.5 second chunks
        const chunkSize = this.decoder.getSampleRate() * this.decoder.getChannels() * 0.5;
        const result = this.decoder.read(chunkSize);
        
        if (result.samplesRead === 0) {
            // End of file
            return;
        }
        
        // Create AudioBuffer from Float32Array
        const audioBuffer = this.audioContext.createBuffer(
            2, // stereo
            result.samplesRead / 2,
            44100
        );
        
        // De-interleave samples (decoder outputs interleaved stereo)
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        
        for (let i = 0; i < result.samplesRead / 2; i++) {
            leftChannel[i] = result.buffer[i * 2];
            rightChannel[i] = result.buffer[i * 2 + 1];
        }
        
        // Schedule playback
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start(this.nextStartTime);
        
        // Update next start time
        this.nextStartTime += audioBuffer.duration;
        
        // Schedule next chunk
        source.onended = () => this.scheduleNextChunk();
    }
    
    seek(seconds) {
        // Stop current playback
        this.audioContext.suspend();
        
        // Seek decoder
        this.decoder.seek(seconds);
        
        // Resume playback
        this.audioContext.resume();
        this.nextStartTime = this.audioContext.currentTime;
        this.scheduleNextChunk();
    }
    
    close() {
        if (this.decoder) {
            this.decoder.close();
            this.decoder = null;
        }
    }
}

// Usage
const player = new ElectronAudioPlayer();
await player.loadFile('music.mp3');
player.startPlayback();

// Seek to 1 minute
player.seek(60);
```

## API Reference

### `FFmpegDecoder`

Main decoder class for audio files.

#### `open(filePath: string): boolean`

Opens an audio file for decoding.

- **Parameters:**
  - `filePath` - Absolute or relative path to audio file
- **Returns:** `true` on success, `false` on failure

```javascript
const decoder = new FFmpegDecoder();
if (!decoder.open('music.mp3')) {
    console.error('Failed to open file');
}
```

#### `close(): void`

Closes the decoder and releases resources.

```javascript
decoder.close();
```

#### `getDuration(): number`

Returns total duration in seconds.

```javascript
const duration = decoder.getDuration(); // e.g., 245.5
```

#### `getSampleRate(): number`

Returns output sample rate (always 44100 Hz).

```javascript
const sampleRate = decoder.getSampleRate(); // 44100
```

#### `getChannels(): number`

Returns number of output channels (always 2 for stereo).

```javascript
const channels = decoder.getChannels(); // 2
```

#### `seek(seconds: number): boolean`

Seeks to specified position in seconds.

- **Parameters:**
  - `seconds` - Position to seek to (0 to duration)
- **Returns:** `true` on success, `false` on failure

```javascript
decoder.seek(30.5); // Seek to 30.5 seconds
```

#### `read(samples: number): { buffer: Float32Array, samplesRead: number }`

Reads audio samples from current position.

- **Parameters:**
  - `samples` - Number of samples to read (includes both channels)
- **Returns:** Object with:
  - `buffer` - Float32Array containing interleaved stereo samples (range: -1.0 to 1.0)
  - `samplesRead` - Actual number of samples read (may be less than requested at end of file)

```javascript
// Read 1 second (44100 Hz * 2 channels = 88200 samples)
const result = decoder.read(88200);

// result.buffer[0] = left channel sample 0
// result.buffer[1] = right channel sample 0
// result.buffer[2] = left channel sample 1
// result.buffer[3] = right channel sample 1
// ...
```

## Deployment Strategies

### 1. NPM Package (Recommended)

Publish with pre-built binaries:

```json
{
  "name": "your-app",
  "dependencies": {
    "ffmpeg-napi-interface": "^1.0.0"
  }
}
```

**Pros:**
- Easy installation
- Automatic platform detection
- Pre-built binaries included

### 2. Bundle with Electron App

Include the native addon in your Electron app:

```bash
# Install in your Electron project
npm install ffmpeg-napi-interface

# Electron will automatically rebuild for correct version
npx electron-rebuild
```

**For electron-builder:**

```json
{
  "build": {
    "files": [
      "node_modules/ffmpeg-napi-interface/**/*"
    ],
    "asarUnpack": [
      "node_modules/ffmpeg-napi-interface/build/**/*",
      "node_modules/ffmpeg-napi-interface/dist/**/*"
    ]
  }
}
```

### 3. Custom Build

Build from source in your CI/CD:

```bash
# Clone and build
git clone https://github.com/herrbasan/ffmpeg-napi-interface.git
cd ffmpeg-napi-interface
npm install
npm run build

# Copy to your project
cp -r build/ ../your-project/native-addons/
cp -r dist/ ../your-project/native-addons/
```

## Platform Support

| Platform | Architecture | Status |
|----------|-------------|---------|
| Windows  | x64         | ✅ Supported |
| Linux    | x64         | ✅ Supported |
| Linux    | ARM64       | ✅ Supported |
| macOS    | x64/ARM64   | ⏳ Coming Soon |

## Supported Formats

All formats supported by FFmpeg, including:

**Compressed:**
- MP3, AAC, OGG Vorbis, Opus, WMA
- FLAC, ALAC, APE, WavPack
- M4A, M4B (audiobooks)

**Uncompressed:**
- WAV, AIFF, AU, PCM

**Exotic:**
- Module formats (MOD, XM, S3M, IT)
- Game audio (VGM, SPC, NSF)
- MIDI (via FluidSynth)

## Performance

- **Seek Time:** < 1ms for most formats
- **Decode Speed:** Real-time or faster (depends on format and CPU)
- **Memory:** ~10MB per decoder instance + audio buffer
- **Output Quality:** Lossless float32 PCM

## Examples

See the [examples/](examples/) directory for complete demos:

- **basic-playback.js** - Simple file decoding
- **seeking.js** - Seek to different positions
- **metadata.js** - Extract file information
- **export-wav.js** - Export decoded audio to WAV
- **real-playback.js** - Real-time playback with speaker package
- **interactive-seek-loop.js** - Interactive player with seek/loop

Run any example:

```bash
node examples/basic-playback.js
node examples/export-wav.js testfiles/music.mp3 -d 10
```

## Troubleshooting

### "Cannot find module 'ffmpeg_napi.node'"

The native addon wasn't built. Run:

```bash
npm run build
```

### "FFmpeg DLLs not found" (Windows)

Download FFmpeg libraries:

```bash
node scripts/download-ffmpeg.js
npm run build
```

### "Wrong architecture" error

Rebuild for your platform:

```bash
npm rebuild
```

For Electron apps:

```bash
npx electron-rebuild
```

### Audio sounds wrong

Check the output format. The decoder always outputs:
- Sample rate: 44100 Hz
- Channels: 2 (stereo)
- Format: Float32 interleaved

If your audio system expects different format, you need to resample.

## Building from Source

See [BUILD.md](docs/BUILD.md) for detailed instructions.

Quick build:

```bash
git clone https://github.com/herrbasan/ffmpeg-napi-interface.git
cd ffmpeg-napi-interface
npm install       # Downloads FFmpeg and installs dependencies
npm run build     # Builds the native addon
npm test          # Run tests
```

## Contributing

Contributions welcome! See [IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md) for architecture details.

## License

MIT License - See [LICENSE](LICENSE) file

## Credits

- FFmpeg binaries from [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)
- Built with [node-addon-api](https://github.com/nodejs/node-addon-api)

## Support

- Issues: https://github.com/herrbasan/ffmpeg-napi-interface/issues
- Discussions: https://github.com/herrbasan/ffmpeg-napi-interface/discussions
