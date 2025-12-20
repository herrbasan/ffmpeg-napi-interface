/**
 * Playback Simulator - Realistic Playback Timing Test
 * 
 * This simulates real-time audio playback with accurate timing,
 * showing how you would integrate with an audio player.
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
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

class AudioPlayer {
    constructor(decoder) {
        this.decoder = decoder;
        this.sampleRate = decoder.getSampleRate();
        this.channels = decoder.getChannels();
        this.duration = decoder.getDuration();
        
        // Playback state
        this.isPlaying = false;
        this.currentTime = 0;
        this.startTime = 0;
        this.pausedTime = 0;
        
        // Buffer settings (simulate audio buffer size)
        this.bufferSize = this.sampleRate * this.channels * 0.1; // 100ms buffer
    }
    
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.startTime = Date.now() - (this.pausedTime * 1000);
        this._playbackLoop();
    }
    
    pause() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.pausedTime = this.currentTime;
    }
    
    seek(seconds) {
        const wasPlaying = this.isPlaying;
        this.pause();
        
        this.currentTime = Math.max(0, Math.min(seconds, this.duration));
        this.pausedTime = this.currentTime;
        this.decoder.seek(this.currentTime);
        
        if (wasPlaying) {
            this.play();
        }
    }
    
    stop() {
        this.pause();
        this.seek(0);
    }
    
    _playbackLoop() {
        if (!this.isPlaying) return;
        
        // Calculate how much time has passed
        const elapsed = (Date.now() - this.startTime) / 1000;
        this.currentTime = elapsed;
        
        // Read next buffer
        const result = this.decoder.read(this.bufferSize);
        
        if (result.samplesRead === 0) {
            // End of file
            this.stop();
            console.log('\n⏹️  Playback finished');
            return;
        }
        
        // Calculate audio levels for visualization
        let peak = 0;
        let sum = 0;
        for (let i = 0; i < result.samplesRead; i++) {
            const amp = Math.abs(result.buffer[i]);
            peak = Math.max(peak, amp);
            sum += amp;
        }
        const avg = sum / result.samplesRead;
        
        // Display playback status
        const progress = (this.currentTime / this.duration) * 100;
        const progressBar = '█'.repeat(Math.floor(progress / 2.5)) + 
                           '░'.repeat(40 - Math.floor(progress / 2.5));
        
        const vuMeter = '▮'.repeat(Math.floor(peak * 20));
        
        process.stdout.write(
            `\r⏵  ${formatTime(this.currentTime)} / ${formatTime(this.duration)} ` +
            `[${progressBar}] ${progress.toFixed(1)}% ` +
            `| VU: ${vuMeter.padEnd(20)} ${(peak * 100).toFixed(0)}%`
        );
        
        // Schedule next buffer (100ms)
        setTimeout(() => this._playbackLoop(), 100);
    }
    
    getStatus() {
        return {
            isPlaying: this.isPlaying,
            currentTime: this.currentTime,
            duration: this.duration,
            progress: (this.currentTime / this.duration) * 100
        };
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function demo() {
    const testFile = findTestFile();
    
    if (!testFile) {
        console.error('No test audio file found');
        process.exit(1);
    }
    
    console.log('Audio Playback Simulator');
    console.log('='.repeat(80));
    console.log(`File: ${path.basename(testFile)}\n`);
    
    const decoder = new FFmpegDecoder();
    
    if (!decoder.open(testFile)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    const player = new AudioPlayer(decoder);
    
    console.log(`Duration: ${formatTime(player.duration)}`);
    console.log(`Sample Rate: ${player.sampleRate} Hz`);
    console.log(`Channels: ${player.channels}\n`);
    
    // Test sequence
    console.log('Test 1: Play for 3 seconds');
    player.play();
    await sleep(3000);
    
    console.log('\n\nTest 2: Pause');
    player.pause();
    await sleep(1000);
    
    console.log('Test 3: Resume playback');
    player.play();
    await sleep(2000);
    
    console.log('\n\nTest 4: Seek to 50%');
    player.seek(player.duration * 0.5);
    await sleep(500);
    
    console.log('Playing from 50%...');
    player.play();
    await sleep(3000);
    
    console.log('\n\nTest 5: Seek backward to 25%');
    player.seek(player.duration * 0.25);
    await sleep(500);
    
    console.log('Playing from 25%...');
    player.play();
    await sleep(3000);
    
    console.log('\n\nTest 6: Jump to near end');
    const nearEnd = Math.max(0, player.duration - 5);
    player.seek(nearEnd);
    await sleep(500);
    
    console.log('Playing until end...');
    player.play();
    
    // Wait for playback to finish
    while (player.isPlaying) {
        await sleep(100);
    }
    
    decoder.close();
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ Playback simulation complete!');
}

demo().catch(err => {
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
});
