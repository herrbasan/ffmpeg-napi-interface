/**
 * Metadata Example
 * Displays detailed information about audio files
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

function findAllTestFiles() {
    const testDir = path.join(__dirname, '..', 'testfiles');
    if (!fs.existsSync(testDir)) return [];
    
    return fs.readdirSync(testDir)
        .filter(f => f.match(/\.(mp3|mp2|m4a|m4b|wav|flac|ogg|aif|aiff|mod|xm|s3m|it)$/i))
        .map(f => path.join(testDir, f));
}

async function analyzeFile(filePath) {
    const decoder = new FFmpegDecoder();
    
    const stats = fs.statSync(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toUpperCase();
    
    console.log('\n' + '─'.repeat(60));
    console.log(`File: ${filename}`);
    console.log('─'.repeat(60));
    
    if (!decoder.open(filePath)) {
        console.log('❌ Failed to open file\n');
        return;
    }
    
    const duration = decoder.getDuration();
    const sampleRate = decoder.getSampleRate();
    const channels = decoder.getChannels();
    const totalSamples = decoder.getTotalSamples();
    
    console.log(`Format:          ${ext.substring(1)}`);
    console.log(`File size:       ${formatBytes(stats.size)}`);
    console.log(`Duration:        ${formatDuration(duration)} (${duration.toFixed(2)}s)`);
    console.log(`Sample rate:     ${sampleRate} Hz`);
    console.log(`Channels:        ${channels} (Stereo)`);
    console.log(`Total samples:   ${totalSamples.toLocaleString()}`);
    console.log(`Bitrate (avg):   ${((stats.size * 8) / duration / 1000).toFixed(2)} kbps`);
    
    // Read small chunk for analysis
    const result = decoder.read(sampleRate * channels); // 1 second
    
    if (result.samplesRead > 0) {
        let maxAmp = 0;
        let sumSquared = 0;
        
        for (let i = 0; i < result.samplesRead; i++) {
            const amp = Math.abs(result.buffer[i]);
            maxAmp = Math.max(maxAmp, amp);
            sumSquared += result.buffer[i] * result.buffer[i];
        }
        
        const rms = Math.sqrt(sumSquared / result.samplesRead);
        
        console.log('\nAudio levels (first second):');
        console.log(`  Peak:          ${(maxAmp * 100).toFixed(2)}% (${(20 * Math.log10(maxAmp)).toFixed(2)} dB)`);
        console.log(`  RMS:           ${(rms * 100).toFixed(2)}% (${(20 * Math.log10(rms)).toFixed(2)} dB)`);
    }
    
    decoder.close();
}

async function main() {
    const testFiles = findAllTestFiles();
    
    if (testFiles.length === 0) {
        console.error('No test audio files found in testfiles/ directory');
        process.exit(1);
    }
    
    console.log('FFmpeg NAPI - Metadata Analysis');
    console.log('='.repeat(60));
    console.log(`Found ${testFiles.length} audio file(s)\n`);
    
    for (const file of testFiles) {
        await analyzeFile(file);
    }
    
    console.log('\n' + '='.repeat(60));
}

main().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
