# Creating a Release

This guide shows how to create a new release with pre-built binaries.

## Quick Release

```bash
# 1. Bump version
npm version patch  # or: minor, major

# 2. Push with tags
git push origin master --tags

# 3. GitHub Actions automatically:
#    - Builds for Windows, Linux x64, Linux ARM64
#    - Creates release with binaries
#    - Users can install without compiling
```

## What Happens

### GitHub Actions Workflow

When you push a tag (e.g., `v1.0.1`), the workflow:

1. **Builds on 3 platforms:**
   - Windows (latest)
   - Linux x64 (Ubuntu)
   - Linux ARM64 (cross-compiled)

2. **For each platform:**
   - Sets up Node.js, Python, build tools
   - Downloads FFmpeg binaries
   - Compiles native addon with node-gyp
   - Packages into `.tar.gz` with DLLs

3. **Creates GitHub Release:**
   - Uploads all 3 binaries as release assets
   - Generates release notes
   - Tags the version

### User Installation

When someone runs `npm install`:

```
npm install github:herrbasan/ffmpeg-napi-interface
  ↓
scripts/install-prebuilt.js runs
  ↓
Detects: Windows x64, v1.0.1
  ↓
Downloads: ffmpeg-napi-v1.0.1-win-x64.tar.gz
  ↓
Extracts to: build/Release/
  ↓
✅ Installation complete (no compilation!)
```

## Manual Release

If you need to trigger manually:

1. Go to: https://github.com/herrbasan/ffmpeg-napi-interface/actions
2. Click "Build and Release" workflow
3. Click "Run workflow"
4. Enter version: `v1.0.1`
5. Click "Run workflow"

## Testing Before Release

```bash
# Build locally
npm run build

# Package binary
npm run package

# Check output
ls prebuilds/
# Should see: ffmpeg-napi-v1.0.0-win-x64.tar.gz

# Test extraction
cd prebuilds
tar -xzf ffmpeg-napi-v1.0.0-win-x64.tar.gz
cd ffmpeg-napi-v1.0.0-win-x64
ls
# Should see: ffmpeg_napi.node, bin/, binary.json
```

## Version Bumping

```bash
# Patch: 1.0.0 → 1.0.1 (bug fixes)
npm version patch

# Minor: 1.0.0 → 1.1.0 (new features, backward compatible)
npm version minor

# Major: 1.0.0 → 2.0.0 (breaking changes)
npm version major
```

This automatically:
- Updates package.json version
- Creates git commit
- Creates git tag
- Ready to push!

## Publishing to NPM (Optional)

To also publish to npm registry:

```bash
# 1. Login to npm
npm login

# 2. Publish
npm publish

# Users can then:
npm install ffmpeg-napi-interface
```

Note: Pre-built binaries work from GitHub, npm, or local install.

## Troubleshooting

### Workflow fails

Check Actions tab for errors. Common issues:

**FFmpeg download fails:**
- BtbN builds might be temporarily down
- Check internet connectivity on runners

**node-gyp errors:**
- Missing build tools on runner
- Check VS version matches (v143)

**Packaging fails:**
- DLLs not copied correctly
- Check paths in package-binary.js

### Binary doesn't download

Users see: `⚠️ Pre-built binary not available`

Reasons:
- Version mismatch (package.json vs git tag)
- Platform not supported
- Release not created yet

Solution: Users can build from source:
```bash
npm run build
```

## Binary Sizes

Approximate sizes per platform:

- Windows x64: ~47 MB
- Linux x64: ~50 MB  
- Linux ARM64: ~50 MB

Most of the size is FFmpeg shared libraries.

## Adding macOS Support

To add macOS builds, update `.github/workflows/release.yml`:

```yaml
- os: macos-latest
  arch: x64
  platform: darwin
- os: macos-latest
  arch: arm64
  platform: darwin
```

Then update `download-ffmpeg.js` to support macOS downloads.
