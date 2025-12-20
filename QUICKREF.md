# FFmpeg NAPI Interface - Quick Reference

## Installation

```bash
npm install
```

## Basic Usage

```javascript
const { FFmpegDecoder } = require('ffmpeg-napi-interface');

const decoder = new FFmpegDecoder();
decoder.open('./audio.mp3');

// Get info
console.log('Duration:', decoder.getDuration());

// Read samples (stereo interleaved float32)
const { buffer, samplesRead } = decoder.read(44100 * 2); // 1 second

// Seek and read
decoder.seek(30.0); // 30 seconds
const chunk = decoder.read(4410 * 2); // 0.1 seconds

decoder.close();
```

## API Reference

| Method | Description | Returns |
|--------|-------------|---------|
| `open(path)` | Open audio file | `boolean` |
| `close()` | Release resources | `void` |
| `seek(seconds)` | Seek to position | `boolean` |
| `read(samples)` | Read audio samples | `{buffer, samplesRead}` |
| `getDuration()` | Get duration | `number` (seconds) |
| `getSampleRate()` | Get sample rate | `44100` |
| `getChannels()` | Get channels | `2` (stereo) |
| `getTotalSamples()` | Get total samples | `number` |
| `isOpen()` | Check if open | `boolean` |

## Output Format

All audio is automatically converted to:
- **Format:** Float32 (32-bit floating-point)
- **Sample Rate:** 44,100 Hz
- **Channels:** 2 (Stereo, interleaved)
- **Range:** -1.0 to +1.0

## Supported Formats

FFmpeg supports 100+ formats including:

**Common:**
MP3, AAC, M4A, FLAC, WAV, OGG, Opus, ALAC

**Legacy:**
MP2, WMA, AIFF, AIF

**Modules:**
MOD, XM, S3M, IT

**Audiobooks:**
M4B, MP3, AAC chapters

## Reading Samples

```javascript
// Calculate samples needed
const sampleRate = 44100;
const channels = 2;
const duration = 1.0; // seconds

const numSamples = sampleRate * channels * duration;
const result = decoder.read(numSamples);

// Access samples
for (let i = 0; i < result.samplesRead; i += 2) {
  const left = result.buffer[i];
  const right = result.buffer[i + 1];
  console.log(`L: ${left.toFixed(4)}, R: ${right.toFixed(4)}`);
}
```

## Common Patterns

### Decode Entire File

```javascript
const decoder = new FFmpegDecoder();
decoder.open('./audio.mp3');

const totalSamples = decoder.getTotalSamples();
const allSamples = decoder.read(totalSamples);

decoder.close();
```

### Stream Processing

```javascript
const decoder = new FFmpegDecoder();
decoder.open('./audio.mp3');

const chunkSize = 44100 * 2; // 1 second chunks

while (true) {
  const { buffer, samplesRead } = decoder.read(chunkSize);
  if (samplesRead === 0) break;
  
  // Process chunk
  processAudio(buffer, samplesRead);
}

decoder.close();
```

### Seek to Position

```javascript
const decoder = new FFmpegDecoder();
decoder.open('./audio.mp3');

// Seek to 25% through file
const duration = decoder.getDuration();
decoder.seek(duration * 0.25);

const chunk = decoder.read(44100 * 2);

decoder.close();
```

### Audio Analysis

```javascript
const { buffer, samplesRead } = decoder.read(44100 * 2);

let peak = 0;
let sum = 0;

for (let i = 0; i < samplesRead; i++) {
  const amp = Math.abs(buffer[i]);
  peak = Math.max(peak, amp);
  sum += buffer[i] * buffer[i];
}

const rms = Math.sqrt(sum / samplesRead);
const peakDb = 20 * Math.log10(peak);
const rmsDb = 20 * Math.log10(rms);

console.log(`Peak: ${(peak * 100).toFixed(2)}% (${peakDb.toFixed(2)} dB)`);
console.log(`RMS: ${(rms * 100).toFixed(2)}% (${rmsDb.toFixed(2)} dB)`);
```

## Build Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install and build everything |
| `npm run setup` | Download FFmpeg binaries |
| `npm run build` | Build native addon |
| `npm run clean` | Clean build artifacts |
| `npm run rebuild` | Full rebuild |
| `npm test` | Run tests |

## Error Handling

```javascript
const decoder = new FFmpegDecoder();

if (!decoder.open('./audio.mp3')) {
  console.error('Failed to open file');
  return;
}

if (!decoder.seek(100.0)) {
  console.error('Seek failed (position out of range?)');
}

const result = decoder.read(44100 * 2);
if (result.samplesRead === 0) {
  console.log('End of file or error');
}

decoder.close();
```

## Performance Tips

1. **Reuse Decoder:** Create once, open multiple files
2. **Chunk Size:** Use 1-2 second chunks for streaming
3. **Seeking:** Backward seeks may be slower than forward
4. **Memory:** Close decoder when done to free resources

## File Paths

- Absolute paths: `C:\\Music\\song.mp3`
- Relative paths: `./audio.mp3`
- Forward slashes work on Windows: `C:/Music/song.mp3`

## Platform Notes

### Windows
- FFmpeg DLLs must be in PATH or same directory as .node file
- Build requires Visual Studio Build Tools

### Linux
- Shared libraries (.so) must be in LD_LIBRARY_PATH
- Build requires build-essential

## Examples

Run examples with:

```bash
node examples/basic-playback.js
node examples/seeking.js
node examples/metadata.js
```

## Troubleshooting

**"Cannot find module 'ffmpeg_napi.node'"**
- Run `npm run build`

**"avformat-XX.dll not found" (Windows)**
- Ensure DLLs copied to build/Release/
- Check binding.gyp copies section

**"Seek failed"**
- Position may be beyond file duration
- Some formats don't support seeking

**"Failed to open file"**
- Check file path and format
- Verify FFmpeg supports the codec

## More Info

- Full docs: `README.md`
- Build guide: `docs/BUILD.md`
- Plan document: `docs/ffmpeg-napi-interface-plan.md`

---

**Version:** 1.0.0  
**License:** MIT  
**FFmpeg:** GPL (from BtbN/FFmpeg-Builds)
