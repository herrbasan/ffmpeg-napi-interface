#!/usr/bin/env node
/**
 * Download FFmpeg shared libraries from BtbN/FFmpeg-Builds
 * Automatically detects platform and downloads appropriate pre-built binaries
 * 
 * Source: https://github.com/BtbN/FFmpeg-Builds
 * License: GPL (for full codec support)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEPS_DIR = path.join(REPO_ROOT, 'deps');
const FFMPEG_BASE_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/';

// Platform detection
const PLATFORM_MAP = {
  'win32-x64': {
    package: 'ffmpeg-master-latest-win64-gpl-shared.zip',
    extractDir: 'ffmpeg-master-latest-win64-gpl-shared',
    targetDir: 'win'
  },
  'linux-x64': {
    package: 'ffmpeg-master-latest-linux64-gpl-shared.tar.xz',
    extractDir: 'ffmpeg-master-latest-linux64-gpl-shared',
    targetDir: 'linux'
  },
  'linux-arm64': {
    package: 'ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz',
    extractDir: 'ffmpeg-master-latest-linuxarm64-gpl-shared',
    targetDir: 'linux-arm64'
  }
};

function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  
  throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          const totalBytes = parseInt(redirectResponse.headers['content-length'], 10);
          let downloadedBytes = 0;
          
          redirectResponse.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
          });
          
          redirectResponse.pipe(file);
          
          file.on('finish', () => {
            file.close();
            console.log('\n✓ Download complete');
            resolve();
          });
        }).on('error', reject);
      } else {
        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\rProgress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('\n✓ Download complete');
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function extractArchive(archivePath, extractDir) {
  console.log(`Extracting: ${path.basename(archivePath)}`);
  
  const platform = process.platform;
  
  try {
    if (archivePath.endsWith('.zip')) {
      // Windows ZIP extraction using PowerShell
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`, {
        stdio: 'inherit'
      });
    } else if (archivePath.endsWith('.tar.xz')) {
      // Linux tar.xz extraction
      execSync(`tar -xJf "${archivePath}" -C "${extractDir}"`, {
        stdio: 'inherit'
      });
    } else {
      throw new Error(`Unknown archive format: ${archivePath}`);
    }
    console.log('✓ Extraction complete');
  } catch (err) {
    throw new Error(`Failed to extract archive: ${err.message}`);
  }
}

function organizeFiles(extractedPath, targetDir) {
  console.log('Organizing FFmpeg files...');
  
  const platform = getPlatformKey();
  const platformTargetDir = path.join(DEPS_DIR, PLATFORM_MAP[platform].targetDir);
  
  // Create target directories
  const binDir = path.join(platformTargetDir, 'bin');
  const libDir = path.join(platformTargetDir, 'lib');
  const includeDir = path.join(DEPS_DIR, 'ffmpeg', 'include');
  
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(libDir, { recursive: true });
  fs.mkdirSync(includeDir, { recursive: true });
  
  // Copy binaries (DLLs or .so files)
  const srcBinDir = path.join(extractedPath, 'bin');
  if (fs.existsSync(srcBinDir)) {
    const binaries = fs.readdirSync(srcBinDir).filter(f => 
      f.endsWith('.dll') || f.endsWith('.so') || f.endsWith('.dylib')
    );
    binaries.forEach(file => {
      fs.copyFileSync(
        path.join(srcBinDir, file),
        path.join(binDir, file)
      );
    });
    console.log(`✓ Copied ${binaries.length} binary files`);
  }
  
  // Copy import libraries (.lib for Windows, .so for Linux)
  const srcLibDir = path.join(extractedPath, 'lib');
  if (fs.existsSync(srcLibDir)) {
    const libs = fs.readdirSync(srcLibDir).filter(f => 
      f.endsWith('.lib') || f.endsWith('.so') || f.endsWith('.a')
    );
    libs.forEach(file => {
      fs.copyFileSync(
        path.join(srcLibDir, file),
        path.join(libDir, file)
      );
    });
    console.log(`✓ Copied ${libs.length} library files`);
  }
  
  // Copy headers
  const srcIncludeDir = path.join(extractedPath, 'include');
  if (fs.existsSync(srcIncludeDir)) {
    copyDirRecursive(srcIncludeDir, includeDir);
    console.log('✓ Copied header files');
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('FFmpeg Download & Setup');
  console.log('='.repeat(60));
  
  try {
    const platformKey = getPlatformKey();
    const platformInfo = PLATFORM_MAP[platformKey];
    
    console.log(`Platform: ${platformKey}`);
    console.log(`Package: ${platformInfo.package}\n`);
    
    // Create deps directory
    fs.mkdirSync(DEPS_DIR, { recursive: true });
    
    // Check if already downloaded
    const targetDir = path.join(DEPS_DIR, platformInfo.targetDir);
    const headersExist = fs.existsSync(path.join(DEPS_DIR, 'ffmpeg', 'include', 'libavformat'));
    const binariesExist = fs.existsSync(path.join(targetDir, 'bin'));
    
    if (headersExist && binariesExist) {
      console.log('✓ FFmpeg libraries already present, skipping download');
      console.log(`  Location: ${DEPS_DIR}`);
      return;
    }
    
    // Download archive
    const downloadUrl = FFMPEG_BASE_URL + platformInfo.package;
    const archivePath = path.join(DEPS_DIR, platformInfo.package);
    
    if (!fs.existsSync(archivePath)) {
      await downloadFile(downloadUrl, archivePath);
    } else {
      console.log('Archive already downloaded, skipping download');
    }
    
    // Extract archive
    const tempExtractDir = path.join(DEPS_DIR, 'temp');
    fs.mkdirSync(tempExtractDir, { recursive: true });
    
    extractArchive(archivePath, tempExtractDir);
    
    // Organize files
    const extractedPath = path.join(tempExtractDir, platformInfo.extractDir);
    organizeFiles(extractedPath, platformInfo.targetDir);
    
    // Cleanup
    console.log('Cleaning up temporary files...');
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
    fs.unlinkSync(archivePath);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ FFmpeg setup complete!');
    console.log(`   Headers: ${path.join(DEPS_DIR, 'ffmpeg', 'include')}`);
    console.log(`   Binaries: ${path.join(targetDir, 'bin')}`);
    console.log(`   Libraries: ${path.join(targetDir, 'lib')}`);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
