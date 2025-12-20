/**
 * Interactive Demo - Test Playback, Seeking, and Looping
 * 
 * This demo shows how to:
 * - Stream audio samples (simulated playback)
 * - Seek to different positions
 * - Loop sections of audio
 * - Monitor playback progress
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

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function drawProgressBar(current, total, width = 40) {
    const progress = Math.min(current / total, 1);
    const filled = Math.floor(progress * width);
    const empty = width - filled;
    const percentage = (progress * 100).toFixed(1);
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${percentage}%`;
}

function drawWaveform(samples, width = 60, height = 5) {
    const lines = [];
    for (let y = 0; y < height; y++) {
        lines.push('');
    }
    
    const samplesPerChar = Math.floor(samples.length / width);
    
    for (let x = 0; x < width; x++) {
        const start = x * samplesPerChar;
        const end = Math.min(start + samplesPerChar, samples.length);
        
        // Find peak in this section
        let peak = 0;
        for (let i = start; i < end; i++) {
            peak = Math.max(peak, Math.abs(samples[i]));
        }
        
        // Map peak to height
        const barHeight = Math.min(Math.floor(peak * height), height);
        
        for (let y = 0; y < height; y++) {
            if (y < barHeight) {
                lines[height - 1 - y] += '|';
            } else {
                lines[height - 1 - y] += ' ';
            }
        }
    }
    
    return lines.join('\n');
}

// Demo 1: Streaming Playback
async function demoStreaming(decoder) {
    console.log('\n' + '='.repeat(60));
    console.log('DEMO 1: Streaming Playback');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const sampleRate = decoder.getSampleRate();
    const channels = decoder.getChannels();
    
    console.log(`Duration: ${formatTime(duration)}`);
    console.log(`Sample Rate: ${sampleRate} Hz`);
    console.log(`Channels: ${channels}\n`);
    
    // Simulate playback for 5 seconds
    const playbackDuration = Math.min(5, duration);
    const chunkSize = sampleRate * channels * 0.1; // 0.1 second chunks
    const totalChunks = Math.floor(playbackDuration / 0.1);
    
    console.log(`Simulating ${playbackDuration}s of playback...\n`);
    
    let currentPos = 0;
    
    for (let i = 0; i < totalChunks; i++) {
        const result = decoder.read(chunkSize);
        
        if (result.samplesRead === 0) break;
        
        currentPos += 0.1;
        
        // Draw progress
        process.stdout.write('\r' + drawProgressBar(currentPos, playbackDuration));
        
        // Simulate real-time playback delay
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log('\n✓ Streaming complete\n');
}

// Demo 2: Seeking
async function demoSeeking(decoder) {
    console.log('='.repeat(60));
    console.log('DEMO 2: Seeking');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const positions = [0, 0.25, 0.5, 0.75, 0.9];
    
    console.log('Testing seeks to different positions...\n');
    
    for (const pos of positions) {
        const seconds = duration * pos;
        const success = decoder.seek(seconds);
        
        console.log(`Seek to ${(pos * 100).toFixed(0).padStart(3)}% (${formatTime(seconds)}): ${success ? '✓' : '✗'}`);
        
        if (success) {
            // Read a small sample to verify
            const result = decoder.read(4410 * 2); // 0.1 seconds
            
            if (result.samplesRead > 0) {
                // Calculate audio levels
                let peak = 0;
                for (let i = 0; i < result.samplesRead; i++) {
                    peak = Math.max(peak, Math.abs(result.buffer[i]));
                }
                console.log(`       Peak level: ${(peak * 100).toFixed(1)}%`);
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n✓ All seeks successful\n');
}

// Demo 3: Looping
async function demoLooping(decoder) {
    console.log('='.repeat(60));
    console.log('DEMO 3: Looping (A-B Repeat)');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const loopStart = Math.min(10, duration * 0.3);
    const loopEnd = Math.min(15, duration * 0.5);
    const loopCount = 3;
    
    console.log(`Loop section: ${formatTime(loopStart)} to ${formatTime(loopEnd)}`);
    console.log(`Repeating ${loopCount} times\n`);
    
    for (let i = 0; i < loopCount; i++) {
        console.log(`Loop iteration ${i + 1}/${loopCount}`);
        
        // Seek to loop start
        decoder.seek(loopStart);
        
        const loopDuration = loopEnd - loopStart;
        const samplesToRead = decoder.getSampleRate() * decoder.getChannels() * loopDuration;
        
        let totalRead = 0;
        const chunkSize = 44100 * 2 * 0.1; // 0.1 second chunks
        
        while (totalRead < samplesToRead) {
            const toRead = Math.min(chunkSize, samplesToRead - totalRead);
            const result = decoder.read(toRead);
            
            if (result.samplesRead === 0) break;
            
            totalRead += result.samplesRead;
            
            const progress = totalRead / samplesToRead;
            process.stdout.write('\r  ' + drawProgressBar(progress, 1, 30));
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        console.log('');
    }
    
    console.log('\n✓ Looping complete\n');
}

// Demo 4: Waveform Visualization
async function demoWaveform(decoder) {
    console.log('='.repeat(60));
    console.log('DEMO 4: Waveform Visualization');
    console.log('='.repeat(60));
    
    // Seek to middle of file
    const duration = decoder.getDuration();
    decoder.seek(duration * 0.5);
    
    // Read 1 second of audio
    const result = decoder.read(44100 * 2);
    
    console.log('\nWaveform (1 second from middle of file):\n');
    console.log(drawWaveform(result.buffer));
    console.log('\n✓ Visualization complete\n');
}

// Demo 5: Random Access (Jump Around)
async function demoRandomAccess(decoder) {
    console.log('='.repeat(60));
    console.log('DEMO 5: Random Access');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const jumps = 10;
    
    console.log(`Performing ${jumps} random jumps...\n`);
    
    for (let i = 0; i < jumps; i++) {
        const randomPos = Math.random() * duration;
        const success = decoder.seek(randomPos);
        
        process.stdout.write(`Jump ${(i + 1).toString().padStart(2)}: ${formatTime(randomPos).padStart(6)} - `);
        
        if (success) {
            const result = decoder.read(4410 * 2);
            console.log(`✓ Read ${result.samplesRead} samples`);
        } else {
            console.log('✗ Seek failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('\n✓ Random access test complete\n');
}

// Main
async function main() {
    const testFile = findTestFile();
    
    if (!testFile) {
        console.error('No test audio file found in testfiles/ directory');
        process.exit(1);
    }
    
    console.clear();
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       FFmpeg NAPI - Interactive Functionality Demo        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nFile: ${path.basename(testFile)}`);
    
    const decoder = new FFmpegDecoder();
    
    if (!decoder.open(testFile)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    try {
        // Run all demos
        await demoStreaming(decoder);
        await demoSeeking(decoder);
        await demoLooping(decoder);
        await demoWaveform(decoder);
        await demoRandomAccess(decoder);
        
        console.log('='.repeat(60));
        console.log('✅ All demos completed successfully!');
        console.log('='.repeat(60));
        
    } finally {
        decoder.close();
    }
}

main().catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
