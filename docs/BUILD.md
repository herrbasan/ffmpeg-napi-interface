# Build Guide

Step-by-step instructions for building the FFmpeg NAPI Interface.

## Prerequisites

### Windows

1. **Node.js 16.0+**
   - Download from: https://nodejs.org/

2. **Visual Studio Build Tools**
   - Download: https://visualstudio.microsoft.com/downloads/
   - Install **Desktop development with C++** workload
   - Required components:
     - MSVC v142 - VS 2019 C++ x64/x86 build tools
     - Windows 10/11 SDK (latest version)
     - C++ build tools

3. **Python 3.x**
   - Download from: https://www.python.org/downloads/
   - Required by node-gyp
   - Must be in PATH

### Linux (Ubuntu/Debian)

```bash
# Install build essentials
sudo apt-get update
sudo apt-get install -y build-essential python3 nodejs npm

# For other distros, install equivalent packages
```

## Build Steps

### 1. Install Dependencies

```bash
npm install
```

This will:
- Install node-addon-api and node-gyp
- Download FFmpeg binaries from BtbN/FFmpeg-Builds
- Build the native addon

### 2. Manual Build (if needed)

If automatic build fails, run these steps manually:

```bash
# Download FFmpeg libraries
npm run setup

# Configure and build
npm run build
```

### 3. Verify Build

```bash
# Run tests
npm test

# Or run examples
node examples/basic-playback.js
node examples/metadata.js
node examples/seeking.js
```

## Build Artifacts

After successful build, you should have:

```
build/
└── Release/
    ├── ffmpeg_napi.node     # Native addon
    ├── avformat-XX.dll      # FFmpeg libraries (Windows)
    ├── avcodec-XX.dll
    ├── avutil-XX.dll
    └── swresample-XX.dll
```

## Troubleshooting

### Windows: "MSBuild not found"

**Solution:** Install Visual Studio Build Tools with C++ workload.

```powershell
# Verify MSBuild installation
& "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\MSBuild\Current\Bin\MSBuild.exe" /version
```

### Windows: "Python not found"

**Solution:** Install Python 3.x and add to PATH.

```powershell
# Verify Python installation
python --version
```

### Linux: "command not found: node-gyp"

**Solution:** Install node-gyp globally.

```bash
npm install -g node-gyp
```

### "Cannot find FFmpeg libraries"

**Solution:** Manually download FFmpeg binaries.

```bash
npm run setup
```

### Build succeeds but tests fail

**Problem:** FFmpeg DLLs not found at runtime.

**Solution (Windows):** Ensure DLLs are in `build/Release/` directory.

```powershell
# Check if DLLs exist
dir build\Release\*.dll
```

## Advanced Build Options

### Debug Build

```bash
npm run build:debug
```

This creates a debug build with symbols for debugging.

### Clean Build

```bash
npm run clean
npm run build
```

### Rebuild

```bash
npm run rebuild
```

## Platform-Specific Notes

### Windows

- Uses MSVC v142 toolset (Visual Studio 2019)
- Requires Windows SDK 10.0.19041.0 or later
- DLLs are automatically copied to build output

### Linux

- Uses GCC/Clang with C++17 support
- Shared libraries (.so files) must be in library path
- May need to set `LD_LIBRARY_PATH`:

```bash
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:./deps/linux/lib
```

### macOS (Future)

Not yet supported. Planned for future release.

## FFmpeg Binary Details

### Source

- **Repository:** https://github.com/BtbN/FFmpeg-Builds
- **Release:** `latest` tag (daily builds)
- **Variant:** GPL-Shared

### Packages

| Platform | Package | Size |
|----------|---------|------|
| Windows x64 | `ffmpeg-master-latest-win64-gpl-shared.zip` | ~88 MB |
| Linux x64 | `ffmpeg-master-latest-linux64-gpl-shared.tar.xz` | ~62 MB |
| Linux ARM64 | `ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz` | ~54 MB |

### Extraction

Downloaded binaries are organized as:

```
deps/
├── ffmpeg/
│   └── include/         # Headers (all platforms)
│       ├── libavformat/
│       ├── libavcodec/
│       ├── libavutil/
│       └── libswresample/
├── win/                 # Windows binaries
│   ├── bin/             # DLLs
│   └── lib/             # Import libraries (.lib)
└── linux/               # Linux binaries
    ├── bin/             # Shared objects
    └── lib/             # .so files
```

## Development Workflow

1. Make changes to C++ source in `src/`
2. Rebuild: `npm run build`
3. Test: `npm test` or `node examples/basic-playback.js`
4. Iterate

## CI/CD Notes

For automated builds, ensure:

1. All prerequisites are installed
2. FFmpeg download succeeds (requires internet)
3. Build tools are in PATH
4. Test files are available (or skip tests)

Example GitHub Actions workflow:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v3
  with:
    node-version: '18'

- name: Setup Python
  uses: actions/setup-python@v4
  with:
    python-version: '3.x'

- name: Install dependencies
  run: npm install

- name: Run tests
  run: npm test
```

## Support

For build issues:
1. Check this guide first
2. Review error messages carefully
3. Check GitHub issues
4. Open new issue with build logs

---

**Last updated:** December 20, 2025
