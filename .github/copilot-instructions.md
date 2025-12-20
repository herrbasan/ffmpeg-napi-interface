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
