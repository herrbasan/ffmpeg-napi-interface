# Release Strategy - Pre-Built Binaries

This document explains how to create releases with pre-built binaries so users don't need to compile from source.

## How It Works

### 1. Automated Builds (GitHub Actions)

When you create a release tag, GitHub Actions automatically:
- Builds the native addon for Windows x64, Linux x64, and Linux ARM64
- Downloads FFmpeg binaries for each platform
- Compiles the C++ code with node-gyp
- Packages everything into `.tar.gz` files
- Uploads them as release assets

### 2. Installation Flow

When users run `npm install ffmpeg-napi-interface`:

**With pre-built binary available:**
1. `install-prebuilt.js` runs
2. Detects platform and architecture
3. Downloads matching binary from GitHub releases
4. Extracts to `build/Release/`
5. **Installation complete** ✅ (no compilation needed)

**Without pre-built binary:**
1. `install-prebuilt.js` fails gracefully
2. User runs `npm run build`
3. Downloads FFmpeg binaries
4. Compiles from source with node-gyp

## Creating a Release

### Option 1: Automatic (Recommended)

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Push the tag
git push origin master --tags

# 3. GitHub Actions builds and creates release automatically
```

### Option 2: Manual

```bash
# 1. Go to GitHub Actions tab
# 2. Click "Build and Release" workflow
# 3. Click "Run workflow"
# 4. Enter version (e.g., v1.0.1)
# 5. Click "Run workflow"
```

## Release Checklist

- [ ] Test builds locally on all platforms
- [ ] Update CHANGELOG.md
- [ ] Update version in package.json
- [ ] Commit changes
- [ ] Create and push git tag
- [ ] Verify GitHub Actions build succeeds
- [ ] Test installing from release
- [ ] Publish to npm (optional)

## Manual Binary Creation

For local testing or custom builds:

```bash
# Build for your platform
npm run build

# Package the binary
npm run package

# Output will be in prebuilds/
# Example: ffmpeg-napi-v1.0.0-win-x64.tar.gz
```

## Testing Pre-Built Binary

```bash
# 1. Create a test directory
mkdir test-prebuilt
cd test-prebuilt

# 2. Install your package
npm install github:herrbasan/ffmpeg-napi-interface

# 3. Should download pre-built binary automatically
# 4. Test it works
node -e "const {FFmpegDecoder} = require('ffmpeg-napi-interface'); console.log('✅ Works!')"
```

## Publishing to NPM

If you want to publish to npm with pre-built binaries:

```bash
# 1. Build and package
npm run build
npm run package

# 2. Login to npm
npm login

# 3. Publish (will run prepublishOnly script)
npm publish

# Note: The package will include source code
# Users will try pre-built binary first, fall back to source
```

## Binary Naming Convention

```
ffmpeg-napi-v{version}-{platform}-{arch}.tar.gz
```

Examples:
- `ffmpeg-napi-v1.0.0-win-x64.tar.gz`
- `ffmpeg-napi-v1.0.0-linux-x64.tar.gz`
- `ffmpeg-napi-v1.0.0-linux-arm64.tar.gz`

## Tarball Contents

Each tarball contains:
```
ffmpeg-napi-v1.0.0-win-x64/
├── ffmpeg_napi.node       # Compiled native addon
├── bin/
│   ├── avformat-62.dll    # FFmpeg libraries
│   ├── avcodec-62.dll
│   ├── avutil-60.dll
│   └── swresample-6.dll
└── binary.json            # Metadata
```

## Platform Support

| Platform | Architecture | Build Method |
|----------|-------------|--------------|
| Windows  | x64         | GitHub Actions (windows-latest) |
| Linux    | x64         | GitHub Actions (ubuntu-latest) |
| Linux    | ARM64       | GitHub Actions (cross-compile) |
| macOS    | x64/ARM64   | Coming soon |

## Troubleshooting

### Build fails on GitHub Actions

Check the workflow logs:
1. Go to Actions tab
2. Click failed workflow
3. Check build logs for errors
4. Common issues:
   - FFmpeg download failed
   - node-gyp errors
   - Missing dependencies

### Binary doesn't download

Users can manually download and extract:
```bash
# Download from releases page
curl -L -o binary.tar.gz https://github.com/herrbasan/ffmpeg-napi-interface/releases/download/v1.0.0/ffmpeg-napi-v1.0.0-win-x64.tar.gz

# Extract
tar -xzf binary.tar.gz

# Move to node_modules
mkdir -p node_modules/ffmpeg-napi-interface/build/Release
cp ffmpeg-napi-v1.0.0-win-x64/* node_modules/ffmpeg-napi-interface/build/Release/
```

### Version mismatch

Make sure:
- package.json version matches git tag
- GitHub release tag matches binary filename
- No typos in version numbers

## Size Optimization

Current binary sizes (approximate):
- Windows x64: ~130 MB (mostly FFmpeg DLLs)
- Linux x64: ~140 MB
- Linux ARM64: ~140 MB

To reduce size:
- Use static linking instead of shared libraries
- Strip debug symbols from native addon
- Compress with better algorithms

## Security

- Binaries are built in isolated GitHub Actions runners
- All builds are reproducible from source
- SHA256 checksums could be added in future
- Users can always build from source if they don't trust binaries
