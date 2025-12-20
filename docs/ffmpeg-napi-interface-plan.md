# FFmpeg NAPI Interface - Development Plan

## Overview
Native Node.js addon providing direct access to FFmpeg libraries (libavformat, libavcodec, libswresample) for audio decoding and future encoding capabilities.

**Repository:** `herrbasan/ffmpeg-napi-interface`

## Project Goals

### Primary (v1.0)
- Decode any audio format FFmpeg supports
- Instant seeking (via `av_seek_frame()`)
- Stream samples on-demand for real-time playback
- Zero dependencies on FFmpeg CLI

### Future (v2.0+)
- Audio encoding (WAV, FLAC, MP3, etc.)
- Real-time audio filters (equalizer, compressor)
- Multi-track synchronous decoding
- Waveform data generation

## Project Structure

```
ffmpeg-napi-interface/
├── src/
│   ├── decoder.cpp           # FFmpegDecoder class
│   ├── decoder.h
│   ├── binding.cpp           # NAPI bindings
│   ├── utils.cpp             # Helper functions
│   └── utils.h
├── deps/
│   ├── ffmpeg/               # FFmpeg headers
│   │   └── include/          # libavformat, libavcodec, etc.
│   ├── win/                  # Windows binaries
│   │   ├── lib/              # Import libraries (.lib)
│   │   └── bin/              # DLLs
│   │       ├── avformat-XX.dll
│   │       ├── avcodec-XX.dll
│   │       ├── swresample-XX.dll
│   │       └── avutil-XX.dll
│   └── linux/                # Linux binaries
│       ├── lib/              # .so files
│       └── include/          # Headers (if needed)
├── dist/                     # Pre-built binaries (committed)
│   ├── win32-x64/
│   │   └── ffmpeg_napi.node
│   └── linux-x64/
│       └── ffmpeg_napi.node
├── test/
│   ├── decoder.test.js
│   ├── samples/              # Test audio files
│   └── benchmark.js
├── examples/
│   ├── basic-playback.js
│   ├── seeking.js
│   └── metadata.js
├── binding.gyp
├── package.json
├── README.md
└── LICENSE
```

## Phase 1: Project Setup

### 1.1 Repository Initialization
```bash
mkdir ffmpeg-napi-interface
cd ffmpeg-napi-interface
git init
npm init -y
```

### 1.2 Install Dependencies
```bash
npm install --save-dev node-gyp node-addon-api
```

**package.json:**
```json
{
  "name": "ffmpeg-napi-interface",
  "version": "1.0.0",
  "description": "Native FFmpeg interface for Node.js via NAPI",
  "main": "index.js",
  "scripts": {
    "install": "node-gyp rebuild",
    "build": "node-gyp rebuild",
    "test": "node test/decoder.test.js"
  },
  "keywords": ["ffmpeg", "audio", "decoder", "napi"],
  "author": "David Renelt",
  "license": "MIT",
  "dependencies": {
    "node-addon-api": "^8.0.0"
  },
  "devDependencies": {
    "node-gyp": "^10.0.0"
  }
}
```

### 1.3 Obtain FFmpeg Libraries

#### Binary Source: BtbN/FFmpeg-Builds

We use pre-built FFmpeg shared libraries from **[BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)**:

| Aspect | Details |
|--------|------|
| **Repository** | https://github.com/BtbN/FFmpeg-Builds |
| **Build frequency** | Daily at 12:00 UTC |
| **Stable URL** | `latest` tag provides consistent download URLs |
| **Retention** | Last 14 daily builds + monthly builds (2 years) |
| **License** | GPL variant includes all codecs (libx264, libx265, etc.) |

#### Download URLs

| Platform | Package | Size |
|----------|---------|------|
| Windows x64 | `ffmpeg-master-latest-win64-gpl-shared.zip` | ~88 MB |
| Linux x64 | `ffmpeg-master-latest-linux64-gpl-shared.tar.xz` | ~62 MB |
| Linux ARM64 | `ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz` | ~54 MB |

Base URL: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/`

#### Why GPL-Shared?

- **GPL** - Full codec support including libx264, libx265, and all audio codecs
- **Shared** - Provides DLLs/SOs + import libraries (.lib) + headers for linking

#### Package Contents

The shared packages contain:
```
ffmpeg-master-latest-win64-gpl-shared/
├── bin/
│   ├── avcodec-XX.dll
│   ├── avformat-XX.dll
│   ├── avutil-XX.dll
│   ├── swresample-XX.dll
│   └── ... (ffmpeg.exe, ffprobe.exe, etc.)
├── lib/
│   ├── avcodec.lib
│   ├── avformat.lib
│   ├── avutil.lib
│   ├── swresample.lib
│   └── ...
├── include/
│   ├── libavcodec/
│   ├── libavformat/
│   ├── libavutil/
│   ├── libswresample/
│   └── ...
└── LICENSE.txt
```

#### Automated Download Script

Create `scripts/download-ffmpeg.js` to:
1. Detect current platform (win64, linux64, linuxarm64)
2. Download appropriate package from BtbN releases
3. Extract to `deps/` directory
4. Organize into platform-specific folders:
   - `deps/win/` - Windows binaries
   - `deps/linux/` - Linux binaries
   - `deps/include/` - Headers (shared across platforms)

#### Integration with npm

```json
{
  "scripts": {
    "setup": "node scripts/download-ffmpeg.js",
    "postinstall": "npm run setup",
    "build": "node-gyp rebuild"
  }
}
```

#### Versioning Strategy

For stability, consider using versioned releases instead of `master`:
- `ffmpeg-n7.1-latest-win64-gpl-shared.zip` (stable 7.1 branch)
- `ffmpeg-n6.1-latest-win64-gpl-shared.zip` (LTS option)

The `master` builds are suitable for development but versioned releases are recommended for production.

## Phase 2: C++ Decoder Implementation

### 2.1 Create Decoder Class

**src/decoder.h:**
```cpp
#ifndef FFMPEG_DECODER_H
#define FFMPEG_DECODER_H

extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswresample/swresample.h>
}

class FFmpegDecoder {
private:
    AVFormatContext* formatCtx;
    AVCodecContext* codecCtx;
    SwrContext* swrCtx;
    AVPacket* packet;
    AVFrame* frame;
    int audioStreamIndex;
    
    // Decoded sample buffer
    float* sampleBuffer;
    int sampleBufferSize;
    int samplesInBuffer;
    int bufferReadPos;
    
    bool initResampler();
    int decodeNextFrame();
    
public:
    FFmpegDecoder();
    ~FFmpegDecoder();
    
    bool open(const char* filePath);
    void close();
    
    bool seek(double seconds);
    int read(float* outBuffer, int numSamples);
    
    // Metadata
    double getDuration() const;
    int getSampleRate() const;
    int getChannels() const;
    int64_t getTotalSamples() const;
};

#endif
```

**src/decoder.cpp:**
```cpp
#include "decoder.h"
#include <cstring>

FFmpegDecoder::FFmpegDecoder() 
    : formatCtx(nullptr)
    , codecCtx(nullptr)
    , swrCtx(nullptr)
    , packet(nullptr)
    , frame(nullptr)
    , audioStreamIndex(-1)
    , sampleBuffer(nullptr)
    , sampleBufferSize(0)
    , samplesInBuffer(0)
    , bufferReadPos(0)
{
    packet = av_packet_alloc();
    frame = av_frame_alloc();
}

FFmpegDecoder::~FFmpegDecoder() {
    close();
    if (packet) av_packet_free(&packet);
    if (frame) av_frame_free(&frame);
}

bool FFmpegDecoder::open(const char* filePath) {
    // Open input file
    if (avformat_open_input(&formatCtx, filePath, nullptr, nullptr) < 0) {
        return false;
    }
    
    // Retrieve stream information
    if (avformat_find_stream_info(formatCtx, nullptr) < 0) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Find audio stream
    audioStreamIndex = -1;
    for (unsigned int i = 0; i < formatCtx->nb_streams; i++) {
        if (formatCtx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
            audioStreamIndex = i;
            break;
        }
    }
    
    if (audioStreamIndex == -1) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Get codec parameters
    AVCodecParameters* codecParams = formatCtx->streams[audioStreamIndex]->codecpar;
    
    // Find decoder
    const AVCodec* codec = avcodec_find_decoder(codecParams->codec_id);
    if (!codec) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Allocate codec context
    codecCtx = avcodec_alloc_context3(codec);
    if (!codecCtx) {
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Copy codec parameters to context
    if (avcodec_parameters_to_context(codecCtx, codecParams) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Open codec
    if (avcodec_open2(codecCtx, codec, nullptr) < 0) {
        avcodec_free_context(&codecCtx);
        avformat_close_input(&formatCtx);
        return false;
    }
    
    // Initialize resampler
    if (!initResampler()) {
        close();
        return false;
    }
    
    // Allocate sample buffer (1 second of audio)
    sampleBufferSize = getSampleRate() * getChannels();
    sampleBuffer = new float[sampleBufferSize];
    
    return true;
}

bool FFmpegDecoder::initResampler() {
    // Set up resampler to output float32 planar stereo at 44100 Hz
    swrCtx = swr_alloc_set_opts(
        nullptr,
        AV_CH_LAYOUT_STEREO,           // Output channel layout
        AV_SAMPLE_FMT_FLT,             // Output sample format (float32)
        44100,                         // Output sample rate
        codecCtx->channel_layout ? codecCtx->channel_layout : AV_CH_LAYOUT_STEREO,
        codecCtx->sample_fmt,          // Input sample format
        codecCtx->sample_rate,         // Input sample rate
        0, nullptr
    );
    
    if (!swrCtx || swr_init(swrCtx) < 0) {
        if (swrCtx) swr_free(&swrCtx);
        return false;
    }
    
    return true;
}

void FFmpegDecoder::close() {
    if (sampleBuffer) {
        delete[] sampleBuffer;
        sampleBuffer = nullptr;
    }
    
    if (swrCtx) {
        swr_free(&swrCtx);
        swrCtx = nullptr;
    }
    
    if (codecCtx) {
        avcodec_free_context(&codecCtx);
        codecCtx = nullptr;
    }
    
    if (formatCtx) {
        avformat_close_input(&formatCtx);
        formatCtx = nullptr;
    }
    
    audioStreamIndex = -1;
    samplesInBuffer = 0;
    bufferReadPos = 0;
}

bool FFmpegDecoder::seek(double seconds) {
    if (!formatCtx) return false;
    
    int64_t timestamp = (int64_t)(seconds * AV_TIME_BASE);
    
    if (av_seek_frame(formatCtx, -1, timestamp, AVSEEK_FLAG_BACKWARD) < 0) {
        return false;
    }
    
    avcodec_flush_buffers(codecCtx);
    
    // Clear internal buffer
    samplesInBuffer = 0;
    bufferReadPos = 0;
    
    return true;
}

int FFmpegDecoder::decodeNextFrame() {
    while (av_read_frame(formatCtx, packet) >= 0) {
        if (packet->stream_index == audioStreamIndex) {
            if (avcodec_send_packet(codecCtx, packet) == 0) {
                if (avcodec_receive_frame(codecCtx, frame) == 0) {
                    // Resample to float32
                    uint8_t* outBuffer = (uint8_t*)sampleBuffer;
                    int outSamples = swr_convert(
                        swrCtx,
                        &outBuffer,
                        frame->nb_samples,
                        (const uint8_t**)frame->data,
                        frame->nb_samples
                    );
                    
                    av_packet_unref(packet);
                    return outSamples * getChannels();
                }
            }
        }
        av_packet_unref(packet);
    }
    
    return 0; // EOF
}

int FFmpegDecoder::read(float* outBuffer, int numSamples) {
    int samplesRead = 0;
    
    while (samplesRead < numSamples) {
        // If buffer is empty, decode next frame
        if (bufferReadPos >= samplesInBuffer) {
            samplesInBuffer = decodeNextFrame();
            bufferReadPos = 0;
            
            if (samplesInBuffer == 0) {
                break; // EOF
            }
        }
        
        // Copy from internal buffer
        int samplesToCopy = std::min(numSamples - samplesRead, samplesInBuffer - bufferReadPos);
        memcpy(outBuffer + samplesRead, sampleBuffer + bufferReadPos, samplesToCopy * sizeof(float));
        
        samplesRead += samplesToCopy;
        bufferReadPos += samplesToCopy;
    }
    
    return samplesRead;
}

double FFmpegDecoder::getDuration() const {
    if (!formatCtx) return 0.0;
    return (double)formatCtx->duration / AV_TIME_BASE;
}

int FFmpegDecoder::getSampleRate() const {
    return 44100; // Always output 44.1kHz
}

int FFmpegDecoder::getChannels() const {
    return 2; // Always output stereo
}

int64_t FFmpegDecoder::getTotalSamples() const {
    return (int64_t)(getDuration() * getSampleRate());
}
```

### 2.2 Create NAPI Bindings

**src/binding.cpp:**
```cpp
#include <napi.h>
#include "decoder.h"

class FFmpegDecoderWrapper : public Napi::ObjectWrap<FFmpegDecoderWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    FFmpegDecoderWrapper(const Napi::CallbackInfo& info);
    ~FFmpegDecoderWrapper();

private:
    FFmpegDecoder* decoder;
    
    Napi::Value Open(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);
    Napi::Value Seek(const Napi::CallbackInfo& info);
    Napi::Value Read(const Napi::CallbackInfo& info);
    
    // Getters
    Napi::Value GetDuration(const Napi::CallbackInfo& info);
    Napi::Value GetSampleRate(const Napi::CallbackInfo& info);
    Napi::Value GetChannels(const Napi::CallbackInfo& info);
};

FFmpegDecoderWrapper::FFmpegDecoderWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<FFmpegDecoderWrapper>(info) {
    decoder = new FFmpegDecoder();
}

FFmpegDecoderWrapper::~FFmpegDecoderWrapper() {
    delete decoder;
}

Napi::Object FFmpegDecoderWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "FFmpegDecoder", {
        InstanceMethod("open", &FFmpegDecoderWrapper::Open),
        InstanceMethod("close", &FFmpegDecoderWrapper::Close),
        InstanceMethod("seek", &FFmpegDecoderWrapper::Seek),
        InstanceMethod("read", &FFmpegDecoderWrapper::Read),
        InstanceAccessor("duration", &FFmpegDecoderWrapper::GetDuration, nullptr),
        InstanceAccessor("sampleRate", &FFmpegDecoderWrapper::GetSampleRate, nullptr),
        InstanceAccessor("channels", &FFmpegDecoderWrapper::GetChannels, nullptr)
    });
    
    Napi::FunctionReference* constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    env.SetInstanceData(constructor);
    
    exports.Set("Decoder", func);
    return exports;
}

Napi::Value FFmpegDecoderWrapper::Open(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    bool success = decoder->open(filePath.c_str());
    
    return Napi::Boolean::New(env, success);
}

void FFmpegDecoderWrapper::Close(const Napi::CallbackInfo& info) {
    decoder->close();
}

Napi::Value FFmpegDecoderWrapper::Seek(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    double seconds = info[0].As<Napi::Number>().DoubleValue();
    bool success = decoder->seek(seconds);
    
    return Napi::Boolean::New(env, success);
}

Napi::Value FFmpegDecoderWrapper::Read(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int numSamples = info[0].As<Napi::Number>().Int32Value();
    
    // Create Float32Array
    Napi::Float32Array result = Napi::Float32Array::New(env, numSamples);
    float* data = result.Data();
    
    int samplesRead = decoder->read(data, numSamples);
    
    // Return slice if we read fewer samples than requested
    if (samplesRead < numSamples) {
        return result.Get(Napi::String::New(env, "slice")).As<Napi::Function>().Call(result, {
            Napi::Number::New(env, 0),
            Napi::Number::New(env, samplesRead)
        });
    }
    
    return result;
}

Napi::Value FFmpegDecoderWrapper::GetDuration(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), decoder->getDuration());
}

Napi::Value FFmpegDecoderWrapper::GetSampleRate(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), decoder->getSampleRate());
}

Napi::Value FFmpegDecoderWrapper::GetChannels(const Napi::CallbackInfo& info) {
    return Napi::Number::New(info.Env(), decoder->getChannels());
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return FFmpegDecoderWrapper::Init(env, exports);
}

NODE_API_MODULE(ffmpeg_napi, InitAll)
```

## Phase 3: Build Configuration

**binding.gyp:**
```python
{
  'targets': [{
    'target_name': 'ffmpeg_napi',
    'sources': [
      'src/decoder.cpp',
      'src/binding.cpp'
    ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")",
      'deps/ffmpeg/include'
    ],
    'conditions': [
      ['OS=="win"', {
        'libraries': [
          '-l<(module_root_dir)/deps/win/lib/avformat.lib',
          '-l<(module_root_dir)/deps/win/lib/avcodec.lib',
          '-l<(module_root_dir)/deps/win/lib/swresample.lib',
          '-l<(module_root_dir)/deps/win/lib/avutil.lib'
        ],
        'copies': [{
          'destination': '<(PRODUCT_DIR)',
          'files': [
            '<(module_root_dir)/deps/win/bin/avformat-XX.dll',
            '<(module_root_dir)/deps/win/bin/avcodec-XX.dll',
            '<(module_root_dir)/deps/win/bin/swresample-XX.dll',
            '<(module_root_dir)/deps/win/bin/avutil-XX.dll'
          ]
        }]
      }],
      ['OS=="linux"', {
        'libraries': [
          '-L<(module_root_dir)/deps/linux/lib',
          '-lavformat',
          '-lavcodec',
          '-lswresample',
          '-lavutil'
        ]
      }]
    ],
    'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
    'cflags!': [ '-fno-exceptions' ],
    'cflags_cc!': [ '-fno-exceptions' ]
  }]
}
```

## Phase 4: JavaScript Wrapper & Testing

**index.js:**
```javascript
const path = require('path');

let addon;

try {
    // Try pre-built binary first
    const platform = process.platform;
    const arch = process.arch;
    const binaryPath = path.join(__dirname, 'dist', `${platform}-${arch}`, 'ffmpeg_napi.node');
    addon = require(binaryPath);
} catch (err) {
    // Fall back to build/Release
    addon = require('./build/Release/ffmpeg_napi.node');
}

module.exports = addon;
```

**test/decoder.test.js:**
```javascript
const FFmpeg = require('../index.js');
const path = require('path');

// Basic open/close test
function testBasic() {
    const decoder = new FFmpeg.Decoder();
    const filePath = path.join(__dirname, 'samples', 'test.aif');
    
    const success = decoder.open(filePath);
    console.log('Open:', success ? 'PASS' : 'FAIL');
    
    console.log('Duration:', decoder.duration);
    console.log('Sample Rate:', decoder.sampleRate);
    console.log('Channels:', decoder.channels);
    
    decoder.close();
}

// Seek test
function testSeek() {
    const decoder = new FFmpeg.Decoder();
    decoder.open(path.join(__dirname, 'samples', 'test.aif'));
    
    const seekSuccess = decoder.seek(5.0);
    console.log('Seek to 5s:', seekSuccess ? 'PASS' : 'FAIL');
    
    decoder.close();
}

// Read samples test
function testRead() {
    const decoder = new FFmpeg.Decoder();
    decoder.open(path.join(__dirname, 'samples', 'test.aif'));
    
    const samples = decoder.read(4096);
    console.log('Read samples:', samples.length, samples.constructor.name);
    console.log('First 10 samples:', Array.from(samples.slice(0, 10)));
    
    decoder.close();
}

testBasic();
testSeek();
testRead();
```

## Phase 5: Pre-Build & Distribution

**Build script:**
```bash
# Build for current platform
npm run build

# Copy to dist/
mkdir -p dist/win32-x64
cp build/Release/ffmpeg_napi.node dist/win32-x64/

# Commit pre-built binary
git add dist/
git commit -m "Add pre-built Windows x64 binary"
```

**Add to .gitignore:**
```
node_modules/
build/
!dist/
```

**Commit FFmpeg DLLs:**
```bash
git add deps/win/bin/*.dll
git commit -m "Add FFmpeg runtime DLLs"
```

## Phase 6: Testing Strategy

### Testing Layers

Given that the target is an Electron app, we use a multi-layer testing approach:

| Layer | Purpose | Environment |
|-------|---------|-------------|
| **Unit Tests** | Core decoder functionality | Node.js (Jest/Mocha) |
| **Integration Tests** | Real audio file decoding | Node.js with testfiles/ |
| **Electron Tests** | IPC, renderer integration | Electron (Playwright/Spectron) |
| **Performance Tests** | Memory leaks, seek speed | Long-running Node.js process |

### Test Directory Structure

```
test/
├── basic.test.js        # Open, read, close
├── seeking.test.js      # Seek accuracy
├── formats.test.js      # All testfiles/ formats
├── stress.test.js       # Memory/performance
└── electron/
    └── integration.js   # Electron-specific tests
```

### Test Categories

#### 1. Decoder Functionality
- Open/close files without crashes
- Read samples correctly (verify sample count, format)
- Seek to arbitrary positions
- Handle EOF gracefully
- Get metadata (duration, sample rate, channels)

#### 2. Format Coverage (using testfiles/)

Test all formats in the `testfiles/` directory:

| Format | Test File | Type |
|--------|-----------|------|
| MOD | `alpmar-3rd_world.mod`, `stasis_field.mod` | Module tracker |
| XM | `ots3.xm` | Extended module |
| S3M | `minute.s3m` | Scream Tracker |
| IT | `_00127.it` | Impulse Tracker |
| MP2 | `audio.mp2` | MPEG Audio Layer 2 |
| AIFF | `go on.loop.aif`, `MTV Freakshow Intro.aiff` | Audio Interchange |
| M4B | `10 to the 16th...m4b` | AAC Audiobook |

All formats must decode to float32 stereo 44.1kHz output.

#### 3. Electron-Specific Tests
- Main process ↔ Renderer IPC for audio data
- Memory stability over extended playback
- Multiple concurrent decoder instances
- Graceful shutdown on app close

### Validation Methods

Since output is audio samples, we validate by:

1. **Sample count** - `duration × sampleRate` should match expected
2. **Non-silence** - Samples should have non-zero values
3. **Format check** - Verify float32 range (-1.0 to 1.0)
4. **Seeking accuracy** - Seek + read should produce expected position

### Basic Test Implementation

**test/basic.test.js:**
```javascript
const FFmpeg = require('../lib/index.js');
const path = require('path');

const TESTFILES = path.join(__dirname, '..', 'testfiles');

async function testOpen() {
    console.log('Test: Open file...');
    const decoder = new FFmpeg.Decoder();
    
    const result = decoder.open(path.join(TESTFILES, 'alpmar-3rd_world.mod'));
    if (!result) throw new Error('Failed to open file');
    
    console.log(`  Duration: ${decoder.duration}s`);
    console.log(`  Sample rate: ${decoder.sampleRate}`);
    console.log(`  Channels: ${decoder.channels}`);
    
    decoder.close();
    console.log('  ✓ PASSED\n');
}

async function testRead() {
    console.log('Test: Read samples...');
    const decoder = new FFmpeg.Decoder();
    decoder.open(path.join(TESTFILES, 'audio.mp2'));
    
    const samples = decoder.read(4096);
    if (samples.length === 0) throw new Error('No samples read');
    
    // Verify float32 range
    for (let i = 0; i < samples.length; i++) {
        if (samples[i] < -1.0 || samples[i] > 1.0) {
            throw new Error(`Sample out of range: ${samples[i]}`);
        }
    }
    
    // Verify non-silence (at least some non-zero samples)
    const hasAudio = samples.some(s => Math.abs(s) > 0.001);
    if (!hasAudio) throw new Error('All samples are silent');
    
    decoder.close();
    console.log(`  ✓ Read ${samples.length} samples, audio detected\n`);
}

async function testSeek() {
    console.log('Test: Seeking...');
    const decoder = new FFmpeg.Decoder();
    decoder.open(path.join(TESTFILES, 'go on.loop.aif'));
    
    const duration = decoder.duration;
    const seekTarget = duration / 2;
    
    const startTime = Date.now();
    const success = decoder.seek(seekTarget);
    const seekTime = Date.now() - startTime;
    
    if (!success) throw new Error('Seek failed');
    if (seekTime > 50) console.warn(`  Warning: Seek took ${seekTime}ms (target <10ms)`);
    
    decoder.close();
    console.log(`  ✓ Seek to ${seekTarget.toFixed(2)}s in ${seekTime}ms\n`);
}

async function testAllFormats() {
    console.log('Test: All formats...');
    const fs = require('fs');
    const files = fs.readdirSync(TESTFILES);
    
    for (const file of files) {
        const decoder = new FFmpeg.Decoder();
        const filePath = path.join(TESTFILES, file);
        
        try {
            const result = decoder.open(filePath);
            if (!result) throw new Error('Failed to open');
            
            const samples = decoder.read(1024);
            decoder.close();
            
            console.log(`  ✓ ${file} (${samples.length} samples)`);
        } catch (err) {
            console.log(`  ✗ ${file}: ${err.message}`);
        }
    }
    console.log('');
}

// Run tests
(async () => {
    console.log('=== FFmpeg NAPI Interface Tests ===\n');
    
    try {
        await testOpen();
        await testRead();
        await testSeek();
        await testAllFormats();
        console.log('All tests passed!');
    } catch (err) {
        console.error('Test failed:', err.message);
        process.exit(1);
    }
})();
```

### npm Test Scripts

```json
{
  "scripts": {
    "test": "node test/basic.test.js",
    "test:formats": "node test/formats.test.js",
    "test:stress": "node test/stress.test.js"
  }
}
```

## Phase 7: Examples

Create examples showing real-world usage:

**examples/basic-playback.js:**
```javascript
const FFmpeg = require('../lib/index.js');
const { AudioContext } = require('web-audio-api'); // Or use Electron's AudioContext

const decoder = new FFmpeg.Decoder();
decoder.open('music.aif');

console.log(`Playing ${decoder.duration}s of audio`);

// Simple playback loop (pseudo-code)
// In real usage, feed to AudioWorklet
setInterval(() => {
    const chunk = decoder.read(4096);
    // feedToAudioWorklet(chunk);
    console.log('Playing chunk:', chunk.length);
}, 100);
```

## Success Criteria

- [ ] Successfully opens AIFF, WAV, MP3, FLAC files
- [ ] Seeking works instantly (<10ms)
- [ ] No memory leaks during long sessions
- [ ] Pre-built binaries work without compilation
- [ ] Works in Electron renderer process
- [ ] Performance matches native FFmpeg CLI

## Implementation Considerations

### 1. Event Loop Blocking

**Risk:** Synchronous `read()` could block 10-50ms for complex codecs (MP3, AAC), causing UI stutters in Electron.

**Mitigation strategies:**
- Keep chunk sizes small (4096 samples ≈ 93ms at 44.1kHz) for acceptable latency
- Consider `Napi::AsyncWorker` for `read()` in future versions
- Document recommended chunk sizes for different use cases

**API Design:** Start with sync `read()` for simplicity, but design interface to support async later:
```javascript
// Current (sync)
const samples = decoder.read(4096);

// Future (async option)
const samples = await decoder.readAsync(4096);
```

### 2. Error Handling

**Problem:** Returning `bool` doesn't explain *why* operations failed.

**Solution:** Throw descriptive `Napi::Error` exceptions instead of returning false:
```cpp
// Instead of:
if (!success) return Napi::Boolean::New(env, false);

// Do this:
if (!success) {
    Napi::Error::New(env, "Failed to open file: codec not found").ThrowAsJavaScriptException();
    return env.Undefined();
}
```

**Error categories to handle:**
- File not found / permission denied
- Unsupported codec
- Corrupted file / invalid format
- Seek out of range
- Memory allocation failure

### 3. Memory Management

**Problem:** Creating new `Float32Array` on every `read()` call puts pressure on garbage collector in tight render loops.

**Solution:** Add `readInto()` method that writes to pre-allocated buffer:
```javascript
// Allocation-free reading (for AudioWorklet use)
const buffer = new Float32Array(4096);
const samplesRead = decoder.readInto(buffer);
```

**C++ signature:**
```cpp
Napi::Value ReadInto(const Napi::CallbackInfo& info) {
    // info[0] = pre-allocated Float32Array
    // info[1] = optional numSamples (defaults to buffer.length)
    Napi::Float32Array buffer = info[0].As<Napi::Float32Array>();
    float* data = buffer.Data();
    int samplesRead = decoder->read(data, buffer.ElementLength());
    return Napi::Number::New(env, samplesRead);
}
```

### 4. DLL/SO Loading (Platform-Specific)

**Windows:**
- Place FFmpeg DLLs in same directory as `.node` file
- Windows searches the `.node` file's directory automatically
- Ensure DLLs are copied to `dist/win32-x64/` alongside the addon

**Linux:**
- Shared objects require `rpath` to find dependencies in same directory
- Add to `binding.gyp` for Linux builds:
```python
'ldflags': [
    '-Wl,-rpath,\'$$ORIGIN\''
]
```

**Electron-specific:**
- Main process: DLLs found normally
- Renderer process (if nodeIntegration enabled): Same as main
- Packaged app: Ensure DLLs are in `resources/` or alongside the app executable

### 5. Thread Safety

**Consideration:** Each `FFmpegDecoder` instance should only be used from one thread.

**Guidance:**
- Create decoder in main process, communicate via IPC to renderer
- Or create separate decoder instance per AudioWorklet
- Document that instances are NOT thread-safe

### 6. FFmpeg DLL Versioning

**Problem:** FFmpeg DLLs have version numbers in filenames (e.g., `avcodec-61.dll`), which change between releases.

**Solution:** The download script should:
1. Parse the downloaded package to find actual DLL filenames
2. Generate a manifest file (`deps/ffmpeg-manifest.json`) with version info
3. Use this manifest in `binding.gyp` or copy all matching DLLs

```json
{
  "version": "7.1",
  "files": {
    "avcodec": "avcodec-61.dll",
    "avformat": "avformat-61.dll",
    "avutil": "avutil-59.dll",
    "swresample": "swresample-5.dll"
  }
}
```

### 7. Prebuilt Binary Detection

**Goal:** Skip build/download if prebuilt binaries exist.

**Implementation in postinstall:**
```javascript
// scripts/postinstall.js
const fs = require('fs');
const path = require('path');

const platform = process.platform;
const arch = process.arch;
const prebuiltPath = path.join(__dirname, '..', 'dist', `${platform}-${arch}`, 'ffmpeg_napi.node');

if (fs.existsSync(prebuiltPath)) {
    console.log('Prebuilt binary found, skipping build.');
    process.exit(0);
}

// Otherwise, run setup and build
require('./download-ffmpeg.js');
```

### 8. Node/Electron Compatibility

**Supported environments:**
- Node.js 16.0+ (N-API version 8+)
- Electron 22+ (uses Node.js 16+)

**N-API guarantees:**
- Stable ABI across Node.js versions
- No recompilation needed when upgrading Node.js minor/patch versions
- Electron compatibility through shared N-API

**Add to package.json:**
```json
{
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### 9. Licensing (GPL)

**Note:** Using `gpl-shared` FFmpeg builds includes GPL-licensed codecs (libx264, libx265, etc.).

**Implications:**
- Source code must be available if distributing the application
- Fine for open-source projects
- For closed-source distribution, consider `lgpl-shared` (fewer codecs but LGPL-compatible)

**Recommendation:** Document license choice in README and include FFmpeg's `LICENSE.txt` in distribution.

### 10. Continuous Integration

**Minimal GitHub Actions workflow (`.github/workflows/build.yml`):**
```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npm run setup
      - run: npm run build
      - run: npm test

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npm run setup
      - run: npm run build
      - run: npm test
```

## Anti-Patterns to Avoid

- **Absolute paths in binding.gyp** - Use `<(module_root_dir)` for portability
- **Relying on system FFmpeg** - Always use bundled binaries for consistency
- **Large blocking reads** - Keep chunks ≤8192 samples on main thread
- **New TypedArray per read** - Use `readInto()` for tight loops
- **Ignoring platform differences** - Test on Windows AND Linux

## Future Roadmap

**v1.1 - Encoding:**
```cpp
class FFmpegEncoder {
    bool open(const char* outputPath, const char* codec, int sampleRate);
    int write(const float* samples, int numSamples);
    void close();
};
```

**v1.2 - Filters:**
```cpp
decoder.setEqualizer(bands);
decoder.setCompressor(threshold, ratio);
```

**v1.3 - Multi-track:**
```cpp
FFmpegMixer mixer;
mixer.addTrack("drums.wav");
mixer.addTrack("bass.wav");
mixer.read(buffer, samples);
```

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/doxygen/trunk/)
- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [node-addon-examples](https://github.com/nodejs/node-addon-examples)
- [LibreMon NAPI Reference](https://github.com/herrbasan/Electron_LibreMon)
