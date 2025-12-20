/**
 * Install pre-built binary from GitHub releases
 * 
 * This script runs on npm install and attempts to download
 * a pre-built binary instead of compiling from source.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pipeline } = require('stream');
const { promisify } = require('util');
const zlib = require('zlib');
const tar = require('tar');

const streamPipeline = promisify(pipeline);

const packageJson = require('../package.json');
const version = packageJson.version;

// Determine platform
const platformMap = {
    'win32': 'win',
    'linux': 'linux',
    'darwin': 'darwin'
};

const platform = platformMap[process.platform] || process.platform;
const arch = process.arch;

const fileName = `ffmpeg-napi-v${version}-${platform}-${arch}.tar.gz`;
const downloadUrl = `https://github.com/herrbasan/ffmpeg-napi-interface/releases/download/v${version}/${fileName}`;

console.log('🔍 Checking for pre-built binary...');
console.log(`   Platform: ${process.platform} (${platform})`);
console.log(`   Architecture: ${arch}`);
console.log(`   Version: v${version}`);
console.log('');

// Check if already built
const addonPath = path.join(__dirname, '..', 'build', 'Release', 'ffmpeg_napi.node');
if (fs.existsSync(addonPath)) {
    console.log('✅ Native addon already exists');
    console.log('   Skipping download');
    process.exit(0);
}

// Download pre-built binary
async function downloadBinary() {
    const tempFile = path.join(__dirname, '..', fileName);
    const buildDir = path.join(__dirname, '..', 'build', 'Release');
    
    try {
        console.log('📥 Downloading pre-built binary...');
        console.log(`   URL: ${downloadUrl}`);
        console.log('');
        
        await new Promise((resolve, reject) => {
            https.get(downloadUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Follow redirect
                    https.get(response.headers.location, (redirectResponse) => {
                        if (redirectResponse.statusCode !== 200) {
                            reject(new Error(`Download failed: ${redirectResponse.statusCode}`));
                            return;
                        }
                        
                        const fileStream = fs.createWriteStream(tempFile);
                        const totalSize = parseInt(redirectResponse.headers['content-length'], 10);
                        let downloaded = 0;
                        
                        redirectResponse.on('data', (chunk) => {
                            downloaded += chunk.length;
                            const percent = ((downloaded / totalSize) * 100).toFixed(1);
                            const mb = (downloaded / 1024 / 1024).toFixed(2);
                            process.stdout.write(`\r   Progress: ${percent}% (${mb} MB)`);
                        });
                        
                        redirectResponse.pipe(fileStream);
                        fileStream.on('finish', () => {
                            fileStream.close();
                            console.log('\n   ✓ Download complete\n');
                            resolve();
                        });
                    }).on('error', reject);
                } else if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(tempFile);
                    const totalSize = parseInt(response.headers['content-length'], 10);
                    let downloaded = 0;
                    
                    response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        const percent = ((downloaded / totalSize) * 100).toFixed(1);
                        const mb = (downloaded / 1024 / 1024).toFixed(2);
                        process.stdout.write(`\r   Progress: ${percent}% (${mb} MB)`);
                    });
                    
                    response.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        console.log('\n   ✓ Download complete\n');
                        resolve();
                    });
                } else if (response.statusCode === 404) {
                    reject(new Error('Pre-built binary not found'));
                } else {
                    reject(new Error(`Download failed: ${response.statusCode}`));
                }
            }).on('error', reject);
        });
        
        // Extract tarball
        console.log('📦 Extracting binary...');
        
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }
        
        // Extract to temp directory first
        const extractDir = path.join(__dirname, '..', 'temp-extract');
        if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true, force: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });
        
        await tar.x({
            file: tempFile,
            cwd: extractDir
        });
        
        // Find the extracted directory
        const extracted = fs.readdirSync(extractDir)[0];
        const extractedPath = path.join(extractDir, extracted);
        
        // Copy files to build directory
        const addonSource = path.join(extractedPath, 'ffmpeg_napi.node');
        const addonDest = path.join(buildDir, 'ffmpeg_napi.node');
        
        if (fs.existsSync(addonSource)) {
            fs.copyFileSync(addonSource, addonDest);
            console.log('   ✓ Copied ffmpeg_napi.node');
        }
        
        // Copy DLLs/shared libraries
        const binSource = path.join(extractedPath, 'bin');
        if (fs.existsSync(binSource)) {
            const files = fs.readdirSync(binSource);
            for (const file of files) {
                fs.copyFileSync(
                    path.join(binSource, file),
                    path.join(buildDir, file)
                );
            }
            console.log(`   ✓ Copied ${files.length} library files`);
        }
        
        // Clean up
        fs.unlinkSync(tempFile);
        fs.rmSync(extractDir, { recursive: true, force: true });
        
        console.log('\n✅ Pre-built binary installed successfully!');
        console.log('   No compilation required');
        
    } catch (err) {
        console.log('\n⚠️  Pre-built binary not available');
        console.log(`   Reason: ${err.message}`);
        console.log('\n📝 You will need to build from source:');
        console.log('   npm run build\n');
        
        // Clean up on error
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        
        // Don't fail the install, just skip
        process.exit(0);
    }
}

downloadBinary();
