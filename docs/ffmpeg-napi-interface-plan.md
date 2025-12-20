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

**Windows (Shared Build):**
1. Download from: https://github.com/BtbN/FFmpeg-Builds/releases
2. Get: `ffmpeg-master-latest-win64-gpl-shared.zip`
3. Extract to `deps/win/`
4. Structure:
   - `deps/win/bin/*.dll` (runtime)
   - `deps/win/lib/*.lib` (import libraries)
   - `deps/win/include/` (headers)

**Linux:**
1. Use system FFmpeg or build from source
2. Copy to `deps/linux/lib/` and `deps/linux/include/`

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

## Phase 6: Integration Testing

Create examples showing real-world usage:

**examples/basic-playback.js:**
```javascript
const FFmpeg = require('../index.js');
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
