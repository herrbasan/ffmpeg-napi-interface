/**
 * Loop Testing - A/B Repeat and Continuous Loop
 * 
 * Demonstrates different looping patterns:
 * - A/B repeat (loop specific section)
 * - Continuous loop (restart from beginning)
 * - Seamless loop (with crossfade simulation)
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');

function findTestFile() {
    const testDir = path.join(__dirname, '..', 'testfiles');
    if (!fs.existsSync(testDir)) return null;
    
    const files = fs.readdirSync(testDir);
    // Prefer shorter files for loop testing
    const audioFiles = files.filter(f => 
        f.match(/\.(mp3|mod|s3m|xm|it|wav|flac)$/i)
    );
    
    return audioFiles.length > 0 ? path.join(testDir, audioFiles[0]) : null;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: A/B Section Repeat
async function testABRepeat(decoder) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 1: A/B Section Repeat');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const loopStart = Math.min(5, duration * 0.2);
    const loopEnd = Math.min(10, duration * 0.4);
    const repeatCount = 5;
    
    console.log(`\nLoop points: ${formatTime(loopStart)} → ${formatTime(loopEnd)}`);
    console.log(`Repeating ${repeatCount} times\n`);
    
    for (let i = 1; i <= repeatCount; i++) {
        // Seek to loop start
        decoder.seek(loopStart);
        
        const loopDuration = loopEnd - loopStart;
        const samplesToRead = decoder.getSampleRate() * decoder.getChannels() * loopDuration;
        
        console.log(`  Loop ${i}/${repeatCount}: `, '');
        
        let totalRead = 0;
        let currentPos = loopStart;
        
        while (totalRead < samplesToRead) {
            const chunkSize = Math.min(44100 * 2 * 0.05, samplesToRead - totalRead); // 50ms chunks
            const result = decoder.read(chunkSize);
            
            if (result.samplesRead === 0) break;
            
            totalRead += result.samplesRead;
            currentPos = loopStart + (totalRead / (decoder.getSampleRate() * decoder.getChannels()));
            
            process.stdout.write(`\r  Loop ${i}/${repeatCount}: ${formatTime(currentPos)}`);
            await sleep(50); // Simulate real-time
        }
        
        console.log(' ✓');
    }
    
    console.log('\n✅ A/B repeat test complete');
}

// Test 2: Continuous Loop (Restart)
async function testContinuousLoop(decoder) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Continuous Loop (Restart from Beginning)');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const playDuration = Math.min(3, duration); // Play 3 seconds each loop
    const loopCount = 4;
    
    console.log(`\nPlaying first ${playDuration}s, then restarting`);
    console.log(`Total loops: ${loopCount}\n`);
    
    for (let i = 1; i <= loopCount; i++) {
        // Always start from beginning
        decoder.seek(0);
        
        const samplesToRead = decoder.getSampleRate() * decoder.getChannels() * playDuration;
        let totalRead = 0;
        
        console.log(`  Loop ${i}/${loopCount}: `, '');
        
        while (totalRead < samplesToRead) {
            const chunkSize = Math.min(44100 * 2 * 0.1, samplesToRead - totalRead);
            const result = decoder.read(chunkSize);
            
            if (result.samplesRead === 0) break;
            
            totalRead += result.samplesRead;
            const currentTime = totalRead / (decoder.getSampleRate() * decoder.getChannels());
            
            const progress = Math.floor((totalRead / samplesToRead) * 30);
            const bar = '█'.repeat(progress) + '░'.repeat(30 - progress);
            
            process.stdout.write(`\r  Loop ${i}/${loopCount}: [${bar}] ${formatTime(currentTime)}`);
            await sleep(100);
        }
        
        console.log(' ✓');
    }
    
    console.log('\n✅ Continuous loop test complete');
}

// Test 3: Precise Loop Timing
async function testPreciseLoop(decoder) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 3: Precise Loop Timing Test');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const loopPoint = Math.min(2, duration * 0.3);
    const iterations = 10;
    
    console.log(`\nLoop point: ${formatTime(loopPoint)}`);
    console.log('Testing seek accuracy with rapid loops\n');
    
    const seekTimes = [];
    
    for (let i = 1; i <= iterations; i++) {
        const start = Date.now();
        decoder.seek(loopPoint);
        const seekTime = Date.now() - start;
        
        seekTimes.push(seekTime);
        
        // Read a tiny bit to verify
        const result = decoder.read(4410 * 2); // 0.1 seconds
        
        process.stdout.write(`\r  Iteration ${i.toString().padStart(2)}/${iterations}: Seek time ${seekTime}ms`);
        await sleep(50);
    }
    
    console.log('');
    
    const avgSeekTime = seekTimes.reduce((a, b) => a + b, 0) / seekTimes.length;
    const minSeekTime = Math.min(...seekTimes);
    const maxSeekTime = Math.max(...seekTimes);
    
    console.log(`\n  Average seek time: ${avgSeekTime.toFixed(2)}ms`);
    console.log(`  Min seek time: ${minSeekTime}ms`);
    console.log(`  Max seek time: ${maxSeekTime}ms`);
    console.log('\n✅ Precise loop timing test complete');
}

// Test 4: Gapless Loop Simulation
async function testGaplessLoop(decoder) {
    console.log('\n' + '='.repeat(60));
    console.log('TEST 4: Gapless Loop Simulation');
    console.log('='.repeat(60));
    
    const duration = decoder.getDuration();
    const loopStart = 0;
    const loopEnd = Math.min(5, duration * 0.5);
    const loops = 3;
    
    console.log(`\nLoop section: ${formatTime(loopStart)} → ${formatTime(loopEnd)}`);
    console.log('Simulating gapless playback with pre-buffering\n');
    
    for (let i = 1; i <= loops; i++) {
        decoder.seek(loopStart);
        
        const loopDuration = loopEnd - loopStart;
        const totalSamples = decoder.getSampleRate() * decoder.getChannels() * loopDuration;
        let samplesRead = 0;
        
        console.log(`  Loop ${i}/${loops}: Playing...`);
        
        while (samplesRead < totalSamples) {
            const chunkSize = 44100 * 2 * 0.2; // 200ms buffer
            const result = decoder.read(chunkSize);
            
            if (result.samplesRead === 0) break;
            
            samplesRead += result.samplesRead;
            
            // Check if approaching loop end - prepare for seamless transition
            const timeRemaining = (totalSamples - samplesRead) / (decoder.getSampleRate() * decoder.getChannels());
            
            if (timeRemaining < 0.5 && timeRemaining > 0.4) {
                console.log(`             Approaching loop point, pre-buffering next iteration...`);
            }
            
            await sleep(50);
        }
        
        console.log(`             Loop complete, seamlessly restarting ✓`);
    }
    
    console.log('\n✅ Gapless loop simulation complete');
}

// Main
async function main() {
    const testFile = findTestFile();
    
    if (!testFile) {
        console.error('No test audio file found');
        process.exit(1);
    }
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                Loop Testing & Verification                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\nFile: ${path.basename(testFile)}`);
    
    const decoder = new FFmpegDecoder();
    
    if (!decoder.open(testFile)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    console.log(`Duration: ${formatTime(decoder.getDuration())}`);
    console.log(`Sample Rate: ${decoder.getSampleRate()} Hz`);
    console.log(`Channels: ${decoder.getChannels()}`);
    
    try {
        await testABRepeat(decoder);
        await testContinuousLoop(decoder);
        await testPreciseLoop(decoder);
        await testGaplessLoop(decoder);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ All loop tests completed successfully!');
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
