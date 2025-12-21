/**
 * Package pre-built binary for release
 * 
 * Creates a tarball with:
 * - Compiled native addon (ffmpeg_napi.node)
 * - FFmpeg DLLs/shared libraries
 * - Platform metadata
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const platform = process.env.PLATFORM || process.platform;
const arch = process.env.ARCH || process.arch;
const version = require('../package.json').version;

// Determine platform suffix
const platformMap = {
    'win32': 'win',
    'linux': 'linux',
    'darwin': 'darwin'
};

const platformName = platformMap[platform] || platform;
const fileName = `ffmpeg-napi-v${version}-${platformName}-${arch}`;
const outputDir = path.join(__dirname, '..', 'prebuilds');
const tempDir = path.join(outputDir, fileName);

console.log('📦 Packaging pre-built binary');
console.log(`   Platform: ${platform}`);
console.log(`   Architecture: ${arch}`);
console.log(`   Version: v${version}`);
console.log('');

// Create output directories
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// Copy native addon
const addonSource = path.join(__dirname, '..', 'build', 'Release', 'ffmpeg_napi.node');
const addonDest = path.join(tempDir, 'ffmpeg_napi.node');

if (!fs.existsSync(addonSource)) {
    console.error('❌ Native addon not found:', addonSource);
    console.error('   Run "npm run build" first');
    process.exit(1);
}

console.log('📄 Copying native addon...');
fs.copyFileSync(addonSource, addonDest);

// Copy JavaScript library files
const libSource = path.join(__dirname, '..', 'lib');
const libDest = path.join(tempDir, 'lib');
fs.mkdirSync(libDest, { recursive: true });

const jsFiles = ['index.js', 'player.js', 'ffmpeg-worklet-processor.js'];
console.log('📄 Copying JavaScript files...');
for (const file of jsFiles) {
    const src = path.join(libSource, file);
    const dest = path.join(libDest, file);
    
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`   ✓ ${file}`);
    } else {
        console.warn(`   ⚠ ${file} not found`);
    }
}

// Copy FFmpeg DLLs/shared libraries
const dllDir = path.join(tempDir, 'bin');
fs.mkdirSync(dllDir, { recursive: true });

let dllSource;
if (platform === 'win32') {
    dllSource = path.join(__dirname, '..', 'build', 'Release');
    const dlls = [
        'avformat-62.dll',
        'avcodec-62.dll',
        'avutil-60.dll',
        'swresample-6.dll'
    ];
    
    console.log('📄 Copying FFmpeg DLLs...');
    for (const dll of dlls) {
        const src = path.join(dllSource, dll);
        const dest = path.join(dllDir, dll);
        
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`   ✓ ${dll}`);
        } else {
            console.warn(`   ⚠ ${dll} not found`);
        }
    }
} else {
    // Linux/macOS shared libraries
    const libDir = path.join(__dirname, '..', 'deps', platform === 'linux' ? 'linux' : 'darwin', 'lib');
    
    if (fs.existsSync(libDir)) {
        console.log('📄 Copying FFmpeg shared libraries...');
        const libs = fs.readdirSync(libDir).filter(f => 
            f.endsWith('.so') || f.endsWith('.so.62') || f.endsWith('.so.60') || f.endsWith('.so.6') ||
            f.endsWith('.dylib')
        );
        
        for (const lib of libs) {
            const src = path.join(libDir, lib);
            const dest = path.join(dllDir, lib);
            fs.copyFileSync(src, dest);
            console.log(`   ✓ ${lib}`);
        }
    }
}

// Create metadata file
const metadata = {
    name: 'ffmpeg-napi-interface',
    version: version,
    platform: platform,
    arch: arch,
    nodeVersion: process.version,
    buildDate: new Date().toISOString()
};

fs.writeFileSync(
    path.join(tempDir, 'binary.json'),
    JSON.stringify(metadata, null, 2)
);

console.log('\n📄 Creating metadata...');
console.log(`   Node version: ${process.version}`);

// Create tarball
console.log('\n📦 Creating tarball...');

const tarballPath = path.join(outputDir, `${fileName}.tar.gz`);

try {
    if (platform === 'win32') {
        // Use PowerShell on Windows
        execSync(
            `tar -czf "${tarballPath}" -C "${outputDir}" "${fileName}"`,
            { stdio: 'inherit' }
        );
    } else {
        // Use tar on Unix
        execSync(
            `tar -czf "${tarballPath}" -C "${outputDir}" "${fileName}"`,
            { stdio: 'inherit' }
        );
    }
    
    const stats = fs.statSync(tarballPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`\n✅ Package created successfully!`);
    console.log(`   File: ${fileName}.tar.gz`);
    console.log(`   Size: ${sizeMB} MB`);
    console.log(`   Path: ${tarballPath}`);
    
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
} catch (err) {
    console.error('❌ Failed to create tarball:', err.message);
    process.exit(1);
}
