# FFmpeg NAPI Interface - Project Instructions

## Project Overview

Native Node.js addon providing direct access to FFmpeg libraries (libavformat, libavcodec, libswresample) for audio decoding and future encoding capabilities.

**Repository:** `herrbasan/ffmpeg-napi-interface`

## Goals

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

## Tech Stack
- **Node.js** with **NAPI** (node-addon-api)
- **C++** for native bindings
- **FFmpeg** libraries: libavformat, libavcodec, libswresample, libavutil
- **node-gyp** for building

## Reference Project

This project follows patterns from another NAPI project:
- **Repository:** https://github.com/herrbasan/LibreHardwareMonitor_NativeNodeIntegration
- **Key patterns to follow:**
  - `binding.gyp` configuration for node-gyp
  - JavaScript wrapper in `lib/index.js`
  - Build scripts in `scripts/`
  - Distribution folder structure in `dist/`
  - MSVC v142 toolset patching for Windows builds

## Test Files

The `testfiles/` directory contains various audio files for testing decoder functionality:
- Module tracker formats: `.mod`, `.xm`, `.s3m`, `.it`
- Audio formats: `.mp2`, `.aif`, `.aiff`, `.m4b`

These files are used to verify that the decoder handles different audio formats correctly.

## Key Implementation Notes

- Output format is always **float32 stereo at 44.1kHz** (resampled via libswresample)
- Uses NAPI for stable ABI across Node.js versions
- Pre-built binaries are committed to `dist/` for each platform
- FFmpeg libraries are stored in `deps/` (not committed, downloaded during setup)

## FFmpeg Binary Source

FFmpeg shared libraries are downloaded from **[BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds)**:
- Daily auto-builds with `latest` tag for stable URLs
- Use `gpl-shared` variant for full codec support + shared libraries
- Packages:
  - Windows: `ffmpeg-master-latest-win64-gpl-shared.zip`
  - Linux: `ffmpeg-master-latest-linux64-gpl-shared.tar.xz`
  - Linux ARM64: `ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz`
