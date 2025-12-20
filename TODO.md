# TODO - Next Steps

## Immediate (Phase 2: First Build)

- [ ] **Fix FFmpeg DLL Names in binding.gyp**
  - Currently uses placeholders: `avformat-XX.dll`
  - After FFmpeg download, update with actual version numbers
  - Example: `avformat-61.dll`, `avcodec-61.dll`, etc.

- [ ] **Run First Build**
  ```bash
  npm install
  ```
  - Downloads FFmpeg binaries
  - Builds native addon
  - Document any errors encountered

- [ ] **Test Basic Functionality**
  ```bash
  npm test
  ```
  - Verify decoder opens files
  - Check sample reading works
  - Validate seeking functionality

- [ ] **Run Examples**
  ```bash
  node examples/basic-playback.js
  node examples/metadata.js
  node examples/seeking.js
  ```

## High Priority

- [ ] **Error Handling Enhancement**
  - Add error message strings to decoder
  - Implement `hasError()` and `getLastError()`
  - Better error reporting from NAPI bindings

- [ ] **Dynamic DLL Loading (Windows)**
  - Auto-detect FFmpeg DLL versions
  - Remove hardcoded version numbers
  - Improve build reliability

- [ ] **Linux Testing**
  - Test build on Linux x64
  - Verify shared library loading
  - Document LD_LIBRARY_PATH requirements

- [ ] **Performance Benchmarking**
  - Measure decoding speed (samples/second)
  - Test seeking latency
  - Memory usage profiling

## Medium Priority

- [ ] **API Enhancements**
  - Add `getMetadata()` for tags (artist, title, etc.)
  - Implement `readInterleaved()` vs `readPlanar()` options
  - Add `getSupportedFormats()` utility

- [ ] **Build System Improvements**
  - Create pre-built binaries for dist/
  - Add platform detection to binding.gyp
  - Automate DLL version detection

- [ ] **Documentation**
  - Add API reference to docs/
  - Create troubleshooting guide
  - Video codec support documentation (future)

- [ ] **Testing**
  - Add unit tests for edge cases
  - Test with corrupted files
  - Stress test with long files

## Low Priority

- [ ] **Optimization**
  - Buffer reuse to reduce allocations
  - Multi-threaded decoding (if beneficial)
  - SIMD optimizations for resampling

- [ ] **Features**
  - Support for video streams (extract audio)
  - Batch file processing
  - Stream from URL/network

- [ ] **Distribution**
  - npm package preparation
  - GitHub releases setup
  - CI/CD pipeline (GitHub Actions)

## Future (v2.0+)

- [ ] **Encoding Support**
  - Add `FFmpegEncoder` class
  - Support WAV, FLAC, MP3 output
  - Implement encoding API

- [ ] **Real-time Filters**
  - Volume control
  - Equalizer
  - Compressor/Limiter
  - Reverb/Echo

- [ ] **Multi-track**
  - Simultaneous decode of multiple files
  - Track synchronization
  - Mixing capabilities

- [ ] **Waveform Generation**
  - Peak/RMS data extraction
  - Spectral analysis
  - Visual waveform rendering

## Known Issues

- [ ] DLL version placeholders (XX) in binding.gyp
- [ ] Error tracking not fully implemented
- [ ] Linux LD_LIBRARY_PATH documentation needed
- [ ] macOS support not yet implemented

## Questions to Answer

- [ ] What FFmpeg version numbers are in latest builds?
- [ ] Does resampler need quality settings?
- [ ] Should we support other output formats (16-bit PCM)?
- [ ] Is AV_CH_LAYOUT_STEREO always defined?

## Testing Checklist

- [ ] Windows x64 build
- [ ] Linux x64 build
- [ ] MP3 decoding
- [ ] FLAC decoding
- [ ] Module format decoding (MOD, XM, etc.)
- [ ] M4B chapter support
- [ ] Seeking accuracy
- [ ] Memory leak testing
- [ ] Thread safety (if used from multiple threads)

## Documentation Checklist

- [x] README.md
- [x] QUICKREF.md
- [x] docs/BUILD.md
- [x] docs/IMPLEMENTATION_SUMMARY.md
- [ ] docs/API.md (detailed API reference)
- [ ] docs/TROUBLESHOOTING.md
- [ ] CHANGELOG.md
- [ ] CONTRIBUTING.md

---

**Last Updated:** December 20, 2025  
**Phase:** 1 Complete, Starting Phase 2
