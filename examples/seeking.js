/**
 * Seeking Example
 * Demonstrates instant seeking to different positions
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');

function findTestFile() {
    const testDir = path.join(__dirname, '..', 'testfiles');
    if (!fs.existsSync(testDir)) return null;
    
    const files = fs.readdirSync(testDir);
    const audioFiles = files.filter(f => 
        f.match(/\.(mp3|mp2|m4a|m4b|wav|flac|ogg|aif|aiff|mod|xm|s3m|it)$/i)
    );
    
    return audioFiles.length > 0 ? path.join(testDir, audioFiles[0]) : null;
}

async function main() {
    const testFile = findTestFile();
    
    if (!testFile) {
        console.error('No test audio file found in testfiles/ directory');
        process.exit(1);
    }
    
    console.log('FFmpeg NAPI - Seeking Example');
    console.log('='.repeat(60));
    console.log(`File: ${path.basename(testFile)}\n`);
    
    const decoder = new FFmpegDecoder();
    
    if (!decoder.open(testFile)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    const duration = decoder.getDuration();
    console.log(`Duration: ${duration.toFixed(2)}s\n`);
    
    // Test seeking to different positions
    const positions = [0, 0.25, 0.5, 0.75, 1.0];
    
    console.log('Testing seeks...');
    for (const pos of positions) {
        const seconds = duration * pos;
        const seekSuccess = decoder.seek(seconds);
        
        console.log(`\nSeek to ${(pos * 100).toFixed(0)}% (${seconds.toFixed(2)}s): ${seekSuccess ? '✓' : '✗'}`);
        
        if (seekSuccess) {
            // Read a small chunk to verify
            const result = decoder.read(4410 * 2); // 0.1 seconds
            console.log(`  Read ${result.samplesRead} samples`);
            
            if (result.samplesRead > 0) {
                // Show first few sample values
                const preview = Array.from(result.buffer.slice(0, 4))
                    .map(v => v.toFixed(4))
                    .join(', ');
                console.log(`  First samples: [${preview}]`);
            }
        }
    }
    
    decoder.close();
    console.log('\n' + '='.repeat(60));
}

main().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
