/**
 * Basic Playback Example
 * Demonstrates decoding and reading audio samples
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');

function findTestFile() {
    const testDir = path.join(__dirname, '..', 'testfiles');
    
    if (!fs.existsSync(testDir)) {
        console.error('testfiles/ directory not found');
        return null;
    }
    
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
    
    console.log('FFmpeg NAPI - Basic Playback Example');
    console.log('='.repeat(60));
    console.log(`File: ${path.basename(testFile)}\n`);
    
    const decoder = new FFmpegDecoder();
    
    // Open file
    if (!decoder.open(testFile)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    // Display metadata
    console.log('Metadata:');
    console.log(`  Duration: ${decoder.getDuration().toFixed(2)}s`);
    console.log(`  Sample Rate: ${decoder.getSampleRate()} Hz`);
    console.log(`  Channels: ${decoder.getChannels()}`);
    console.log(`  Total Samples: ${decoder.getTotalSamples()}\n`);
    
    // Read first 0.5 seconds
    console.log('Reading first 0.5 seconds...');
    const samplesPerHalfSecond = decoder.getSampleRate() * decoder.getChannels() * 0.5;
    const result = decoder.read(samplesPerHalfSecond);
    
    console.log(`  Requested: ${samplesPerHalfSecond} samples`);
    console.log(`  Read: ${result.samplesRead} samples`);
    console.log(`  Buffer type: ${result.buffer.constructor.name}`);
    console.log(`  Buffer length: ${result.buffer.length}\n`);
    
    // Analyze audio levels
    if (result.samplesRead > 0) {
        const samples = result.buffer;
        let maxAmp = 0;
        let sumSquared = 0;
        
        for (let i = 0; i < result.samplesRead; i++) {
            const amp = Math.abs(samples[i]);
            maxAmp = Math.max(maxAmp, amp);
            sumSquared += samples[i] * samples[i];
        }
        
        const rms = Math.sqrt(sumSquared / result.samplesRead);
        
        console.log('Audio Analysis:');
        console.log(`  Peak amplitude: ${maxAmp.toFixed(4)}`);
        console.log(`  RMS level: ${rms.toFixed(4)}`);
        console.log(`  Peak dB: ${(20 * Math.log10(maxAmp)).toFixed(2)} dB`);
        console.log(`  RMS dB: ${(20 * Math.log10(rms)).toFixed(2)} dB\n`);
    }
    
    // Seek to middle of file
    const midpoint = decoder.getDuration() / 2;
    console.log(`Seeking to ${midpoint.toFixed(2)}s...`);
    decoder.seek(midpoint);
    
    // Read 0.1 seconds from midpoint
    const samplesPerTenth = decoder.getSampleRate() * decoder.getChannels() * 0.1;
    const result2 = decoder.read(samplesPerTenth);
    console.log(`  Read ${result2.samplesRead} samples from midpoint\n`);
    
    // Close decoder
    decoder.close();
    console.log('Decoder closed.');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
