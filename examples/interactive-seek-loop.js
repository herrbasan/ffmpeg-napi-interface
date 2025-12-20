/**
 * Interactive Seek & Loop Demo - Real Audio Playback
 * 
 * This demonstrates real streaming, seeking, and looping with actual audio output.
 * 
 * Usage:
 *   node examples/interactive-seek-loop.js [filename]
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

let Speaker;
try {
    Speaker = require('speaker');
} catch (err) {
    console.error('❌ speaker package required: npm install speaker');
    process.exit(1);
}

class InteractivePlayer {
    constructor(filePath) {
        this.filePath = filePath;
        this.decoder = new FFmpegDecoder();
        this.speaker = null;
        this.playing = false;
        this.streaming = false;
        this.position = 0;
        this.loopStart = null;
        this.loopEnd = null;
        
        if (!this.decoder.open(filePath)) {
            throw new Error('Failed to open file');
        }
        
        this.sampleRate = this.decoder.getSampleRate();
        this.channels = this.decoder.getChannels();
        this.duration = this.decoder.getDuration();
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    play() {
        if (this.playing) return;
        
        // Make sure any previous speaker is closed
        if (this.speaker) {
            try {
                this.speaker.close();
            } catch (err) {
                // Already closed
            }
            this.speaker = null;
        }
        
        this.playing = true;
        this.streaming = true;
        
        this.speaker = new Speaker({
            channels: this.channels,
            bitDepth: 16,
            sampleRate: this.sampleRate,
            highWaterMark: 65536
        });
        
        this.speaker.on('error', (err) => {
            console.error('Speaker error:', err.message);
        });
        
        const chunkSize = this.sampleRate * this.channels * 0.5;
        
        const streamAudio = () => {
            if (!this.streaming || !this.speaker) {
                return;
            }
            
            for (let i = 0; i < 3; i++) {
                if (!this.streaming || !this.speaker) break;
                
                const result = this.decoder.read(chunkSize);
                
                if (result.samplesRead === 0) {
                    console.log('\n🔚 End of file reached');
                    this.streaming = false;
                    this.playing = false;
                    if (this.speaker) {
                        this.speaker.end();
                        this.speaker = null;
                    }
                    this.showPrompt();
                    return;
                }
                
                this.position += result.samplesRead / (this.sampleRate * this.channels);
                
                if (this.loopEnd !== null && this.position >= this.loopEnd) {
                    console.log(`\n🔁 Loop point reached, jumping back to ${this.formatTime(this.loopStart)}`);
                    this.decoder.seek(this.loopStart);
                    this.position = this.loopStart;
                    this.showPrompt();
                    return;
                }
                
                const buffer = Buffer.alloc(result.samplesRead * 2);
                for (let j = 0; j < result.samplesRead; j++) {
                    const sample = Math.max(-1, Math.min(1, result.buffer[j]));
                    const pcm = Math.floor(sample * 32767);
                    buffer.writeInt16LE(pcm, j * 2);
                }
                
                if (this.streaming && this.speaker && !this.speaker.destroyed) {
                    try {
                        this.speaker.write(buffer);
                    } catch (err) {
                        this.streaming = false;
                        return;
                    }
                }
            }
            
            if (this.streaming && this.speaker) {
                setImmediate(streamAudio);
            }
        };
        
        streamAudio();
        console.log('▶️  Playing...');
    }
    
    pause() {
        if (!this.playing) return;
        
        this.playing = false;
        this.streaming = false;
        
        setTimeout(() => {
            if (this.speaker) {
                try {
                    this.speaker.close();
                } catch (err) {
                    // Already closed
                }
                this.speaker = null;
            }
        }, 50);
        
        console.log(`⏸️  Paused at ${this.formatTime(this.position)}`);
    }
    
    stop() {
        this.pause();
        this.position = 0;
        this.decoder.seek(0);
        console.log('⏹️  Stopped');
    }
    
    seek(seconds) {
        const wasPlaying = this.playing;
        
        this.streaming = false;
        this.playing = false;
        
        setTimeout(() => {
            if (this.speaker) {
                try {
                    this.speaker.close();
                } catch (err) {
                    // Already closed
                }
                this.speaker = null;
            }
            
            this.decoder.seek(seconds);
            this.position = seconds;
            console.log(`⏩ Seeked to ${this.formatTime(seconds)}`);
            
            if (wasPlaying) {
                setTimeout(() => this.play(), 100);
            }
        }, 100);
    }
    
    setLoop(start, end) {
        this.loopStart = start;
        this.loopEnd = end;
        console.log(`🔁 Loop set: ${this.formatTime(start)} → ${this.formatTime(end)}`);
    }
    
    clearLoop() {
        this.loopStart = null;
        this.loopEnd = null;
        console.log('🔓 Loop cleared');
    }
    
    showStatus() {
        console.log('\n📊 Status:');
        console.log(`   File: ${path.basename(this.filePath)}`);
        console.log(`   Duration: ${this.formatTime(this.duration)}`);
        console.log(`   Position: ${this.formatTime(this.position)}`);
        console.log(`   State: ${this.playing ? '▶️ Playing' : '⏸️ Paused'}`);
        if (this.loopStart !== null) {
            console.log(`   Loop: ${this.formatTime(this.loopStart)} → ${this.formatTime(this.loopEnd)}`);
        }
        console.log('');
    }
    
    showHelp() {
        console.log('\n📖 Commands:');
        console.log('   play / p        - Start playback');
        console.log('   pause           - Pause playback');
        console.log('   stop / s        - Stop playback');
        console.log('   seek <sec>      - Seek to position (e.g., "seek 30")');
        console.log('   loop <s> <e>    - Set loop points (e.g., "loop 10 20")');
        console.log('   clearloop       - Clear loop');
        console.log('   status          - Show current status');
        console.log('   help / h        - Show this help');
        console.log('   quit / q        - Exit');
        console.log('');
    }
    
    showPrompt() {
        process.stdout.write('🎵 > ');
    }
    
    close() {
        this.pause();
        this.decoder.close();
    }
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

// Main
const args = process.argv.slice(2);
const testFile = args[0] || findTestFile();

if (!testFile) {
    console.error('No audio file specified');
    process.exit(1);
}

console.log('🎵 FFmpeg NAPI - Interactive Player');
console.log('='.repeat(60));
console.log(`File: ${path.basename(testFile)}\n`);

const player = new InteractivePlayer(testFile);

player.showHelp();
player.showStatus();
player.showPrompt();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ''
});

rl.on('line', (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    
    switch (cmd) {
        case 'play':
        case 'p':
            player.play();
            break;
            
        case 'pause':
            player.pause();
            break;
            
        case 'stop':
        case 's':
            player.stop();
            break;
            
        case 'seek':
            if (parts[1]) {
                player.seek(parseFloat(parts[1]));
            } else {
                console.log('Usage: seek <seconds>');
            }
            break;
            
        case 'loop':
            if (parts[1] && parts[2]) {
                player.setLoop(parseFloat(parts[1]), parseFloat(parts[2]));
            } else {
                console.log('Usage: loop <start> <end>');
            }
            break;
            
        case 'clearloop':
            player.clearLoop();
            break;
            
        case 'status':
            player.showStatus();
            break;
            
        case 'help':
        case 'h':
            player.showHelp();
            break;
            
        case 'quit':
        case 'q':
        case 'exit':
            console.log('👋 Goodbye!');
            player.close();
            process.exit(0);
            break;
            
        case '':
            break;
            
        default:
            console.log(`Unknown command: ${cmd}`);
            break;
    }
    
    player.showPrompt();
});

rl.on('close', () => {
    player.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    player.close();
    process.exit(0);
});
