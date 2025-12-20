/**
 * Real Audio Playback - Output to Speakers
 * 
 * This example plays audio through your speakers using the 'speaker' package.
 * 
 * Installation required:
 *   npm install speaker
 * 
 * Controls:
 *   - Plays audio in real-time
 *   - Press Ctrl+C to stop
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');

// Check if speaker package is available
let Speaker;
try {
    Speaker = require('speaker');
} catch (err) {
    console.error('❌ speaker package not found!');
    console.error('\nTo enable real audio playback, install the speaker package:');
    console.error('  npm install speaker\n');
    console.error('Then run this example again.');
    process.exit(1);
}

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

async function playAudio(filePath, duration = null) {
    console.log('🎵 FFmpeg NAPI - Real Audio Playback');
    console.log('='.repeat(60));
    console.log(`File: ${path.basename(filePath)}\n`);
    
    const decoder = new FFmpegDecoder();
    
    if (!decoder.open(filePath)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    const totalDuration = decoder.getDuration();
    const playDuration = duration || Math.min(30, totalDuration); // Default: 30 seconds or full file
    
    console.log(`Duration: ${formatTime(totalDuration)}`);
    console.log(`Sample Rate: ${decoder.getSampleRate()} Hz`);
    console.log(`Channels: ${decoder.getChannels()}`);
    console.log(`\nPlaying ${formatTime(playDuration)}...\n`);
    console.log('Press Ctrl+C to stop\n');
    
    // Create speaker instance (16-bit PCM for Windows compatibility)
    const speaker = new Speaker({
        channels: decoder.getChannels(),
        bitDepth: 16,
        sampleRate: decoder.getSampleRate()
    });
    
    // Handle errors
    speaker.on('error', (err) => {
        console.error('Speaker error:', err);
    });
    
    // Track playback
    let samplesPlayed = 0;
    const totalSamples = decoder.getSampleRate() * decoder.getChannels() * playDuration;
    const chunkSize = decoder.getSampleRate() * decoder.getChannels() * 0.1; // 100ms chunks
    
    let lastUpdateTime = Date.now();
    
    // Playback loop
    const playbackInterval = setInterval(() => {
        const result = decoder.read(chunkSize);
        
        if (result.samplesRead === 0 || samplesPlayed >= totalSamples) {
            // End of playback
            clearInterval(playbackInterval);
            speaker.end();
            console.log('\n\n✅ Playback complete!');
            decoder.close();
            return;
        }
        
        samplesPlayed += result.samplesRead;
        
        // Convert Float32 to 16-bit PCM for speaker
        const buffer = Buffer.alloc(result.samplesRead * 2); // 2 bytes per sample
        for (let i = 0; i < result.samplesRead; i++) {
            // Clamp to [-1, 1] and convert to 16-bit signed integer
            const sample = Math.max(-1, Math.min(1, result.buffer[i]));
            const pcm = Math.floor(sample * 32767);
            buffer.writeInt16LE(pcm, i * 2);
        }
        speaker.write(buffer);
        
        // Update progress (every 500ms)
        const now = Date.now();
        if (now - lastUpdateTime > 500) {
            const currentTime = samplesPlayed / (decoder.getSampleRate() * decoder.getChannels());
            const progress = (samplesPlayed / totalSamples) * 100;
            const bar = '█'.repeat(Math.floor(progress / 2.5)) + '░'.repeat(40 - Math.floor(progress / 2.5));
            
            // Calculate audio level
            let peak = 0;
            for (let i = 0; i < result.samplesRead; i++) {
                peak = Math.max(peak, Math.abs(result.buffer[i]));
            }
            const vuMeter = '▮'.repeat(Math.floor(peak * 20));
            
            process.stdout.write(
                `\r🔊 ${formatTime(currentTime)} / ${formatTime(playDuration)} ` +
                `[${bar}] ${progress.toFixed(1)}% | ${vuMeter.padEnd(20)}`
            );
            
            lastUpdateTime = now;
        }
    }, 100); // Run every 100ms
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n\n⏹️  Stopped by user');
        clearInterval(playbackInterval);
        speaker.end();
        decoder.close();
        process.exit(0);
    });
}

// Main
const testFile = findTestFile();

if (!testFile) {
    console.error('No test audio file found in testfiles/ directory');
    process.exit(1);
}

// Check for command line arguments
const args = process.argv.slice(2);
let duration = null;
let seekTo = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--duration' || args[i] === '-d') {
        duration = parseFloat(args[i + 1]);
        i++;
    } else if (args[i] === '--seek' || args[i] === '-s') {
        seekTo = parseFloat(args[i + 1]);
        i++;
    }
}

// Seek if requested
if (seekTo !== null) {
    const decoder = new FFmpegDecoder();
    decoder.open(testFile);
    console.log(`Seeking to ${seekTo} seconds...`);
    decoder.seek(seekTo);
    decoder.close();
}

playAudio(testFile, duration).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
