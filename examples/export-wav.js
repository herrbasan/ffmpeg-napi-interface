/**
 * WAV File Writer - Export decoded audio to WAV file
 * 
 * This example decodes audio and writes it to a WAV file
 * that can be played with any audio player.
 * 
 * No additional dependencies needed!
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');
const fs = require('fs');

function findTestFile() {
    const testDir = path.join(__dirname, '..', 'testfiles');
    if (!fs.existsSync(testDir)) return null;
    
    const files = fs.readdirSync(testDir);
    const audioFiles = files.filter(f => 
        f.match(/\.(mp3|mp2|m4a|m4b|flac|ogg|aif|aiff|mod|xm|s3m|it)$/i)
    );
    
    return audioFiles.length > 0 ? path.join(testDir, audioFiles[0]) : null;
}

function writeWavHeader(buffer, sampleRate, numChannels, numSamples) {
    const byteRate = sampleRate * numChannels * 4; // 32-bit float = 4 bytes
    const blockAlign = numChannels * 4;
    const dataSize = numSamples * 4;
    
    let offset = 0;
    
    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;
    
    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
    buffer.writeUInt16LE(3, offset); offset += 2;  // format: IEEE float
    buffer.writeUInt16LE(numChannels, offset); offset += 2;
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(blockAlign, offset); offset += 2;
    buffer.writeUInt16LE(32, offset); offset += 2; // bits per sample
    
    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;
    
    return offset;
}

async function exportToWav(inputFile, outputFile, duration = null, seekTo = null) {
    console.log('🎵 FFmpeg NAPI - WAV Export');
    console.log('='.repeat(60));
    console.log(`Input: ${path.basename(inputFile)}`);
    console.log(`Output: ${outputFile}\n`);
    
    const decoder = new FFmpegDecoder();
    
    if (!decoder.open(inputFile)) {
        console.error('Failed to open file');
        process.exit(1);
    }
    
    const sampleRate = decoder.getSampleRate();
    const channels = decoder.getChannels();
    const totalDuration = decoder.getDuration();
    
    // Determine export duration
    let exportDuration = duration || Math.min(30, totalDuration);
    
    // Seek if requested
    if (seekTo !== null) {
        console.log(`Seeking to ${seekTo}s...`);
        decoder.seek(seekTo);
        exportDuration = Math.min(exportDuration, totalDuration - seekTo);
    }
    
    console.log(`Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Sample Rate: ${sampleRate} Hz`);
    console.log(`Channels: ${channels}`);
    console.log(`Export Duration: ${exportDuration.toFixed(2)}s\n`);
    
    const totalSamples = Math.floor(sampleRate * channels * exportDuration);
    
    // Create WAV file
    const headerSize = 44;
    const dataSize = totalSamples * 4; // 32-bit float
    const wavBuffer = Buffer.alloc(headerSize + dataSize);
    
    // Write WAV header
    writeWavHeader(wavBuffer, sampleRate, channels, totalSamples);
    
    // Read and write audio data
    let samplesRead = 0;
    let bufferOffset = headerSize;
    const chunkSize = sampleRate * channels; // 1 second chunks
    
    console.log('Decoding audio...\n');
    
    while (samplesRead < totalSamples) {
        const toRead = Math.min(chunkSize, totalSamples - samplesRead);
        const result = decoder.read(toRead);
        
        if (result.samplesRead === 0) break;
        
        // Copy float32 data to WAV buffer
        for (let i = 0; i < result.samplesRead; i++) {
            wavBuffer.writeFloatLE(result.buffer[i], bufferOffset);
            bufferOffset += 4;
        }
        
        samplesRead += result.samplesRead;
        
        const progress = (samplesRead / totalSamples) * 100;
        const bar = '█'.repeat(Math.floor(progress / 2.5)) + '░'.repeat(40 - Math.floor(progress / 2.5));
        process.stdout.write(`\r[${bar}] ${progress.toFixed(1)}%`);
    }
    
    console.log('\n\nWriting WAV file...');
    
    // Write to file
    fs.writeFileSync(outputFile, wavBuffer.slice(0, headerSize + samplesRead * 4));
    
    const fileSizeMB = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);
    
    console.log(`\n✅ Export complete!`);
    console.log(`   File: ${outputFile}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    console.log(`   Samples: ${samplesRead.toLocaleString()}`);
    
    decoder.close();
    
    // Try to play the file
    console.log('\n🔊 Opening file with default player...');
    
    try {
        const { exec } = require('child_process');
        
        // Windows: use start command
        if (process.platform === 'win32') {
            exec(`start "" "${outputFile}"`);
        } 
        // macOS: use open command
        else if (process.platform === 'darwin') {
            exec(`open "${outputFile}"`);
        }
        // Linux: use xdg-open
        else {
            exec(`xdg-open "${outputFile}"`);
        }
        
        console.log('✅ File opened in default player');
    } catch (err) {
        console.log(`   You can play the file manually: ${outputFile}`);
    }
}

// Main
// Parse command line arguments first to check for input file
const args = process.argv.slice(2);
let inputFile = null;
let outputFile = 'output.wav';
let duration = null;
let seekTo = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
        outputFile = args[i + 1];
        i++;
    } else if (args[i] === '--duration' || args[i] === '-d') {
        duration = parseFloat(args[i + 1]);
        i++;
    } else if (args[i] === '--seek' || args[i] === '-s') {
        seekTo = parseFloat(args[i + 1]);
        i++;
    } else if (!args[i].startsWith('-')) {
        inputFile = args[i];
    }
}

// Use provided file or find test file
const testFile = inputFile || findTestFile();

if (!testFile) {
    console.error('No test audio file found in testfiles/ directory');
    process.exit(1);
}

exportToWav(testFile, outputFile, duration, seekTo).catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
