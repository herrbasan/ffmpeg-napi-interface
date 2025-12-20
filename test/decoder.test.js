/**
 * Basic FFmpeg Decoder Test
 * Run with: node test/decoder.test.js
 */

const { FFmpegDecoder } = require('../lib/index');
const path = require('path');

async function runTests() {
    console.log('FFmpeg NAPI Decoder - Basic Test');
    console.log('='.repeat(60));
    
    const decoder = new FFmpegDecoder();
    
    // Test with first available test file
    const testFiles = [
        path.join(__dirname, '..', 'testfiles', 'audio.mp2'),
        path.join(__dirname, '..', 'testfiles', '10 to the 16th to 1 [B004FRN94I] - 1 - Chapter 1.m4b'),
        path.join(__dirname, '..', 'testfiles', 'alpmar-3rd_world.mod')
    ];
    
    let testFile = null;
    const fs = require('fs');
    
    for (const file of testFiles) {
        if (fs.existsSync(file)) {
            testFile = file;
            break;
        }
    }
    
    if (!testFile) {
        console.error('❌ No test files found in testfiles/ directory');
        process.exit(1);
    }
    
    console.log(`\nTest file: ${path.basename(testFile)}`);
    
    // Test 1: Open file
    console.log('\n1. Opening file...');
    const opened = decoder.open(testFile);
    if (!opened) {
        console.error('❌ Failed to open file');
        process.exit(1);
    }
    console.log('✓ File opened successfully');
    
    // Test 2: Get metadata
    console.log('\n2. Reading metadata...');
    console.log(`   Duration: ${decoder.getDuration().toFixed(2)}s`);
    console.log(`   Sample Rate: ${decoder.getSampleRate()} Hz`);
    console.log(`   Channels: ${decoder.getChannels()}`);
    console.log(`   Total Samples: ${decoder.getTotalSamples()}`);
    console.log(`   Is Open: ${decoder.isOpen()}`);
    
    // Test 3: Read samples
    console.log('\n3. Reading samples...');
    const result = decoder.read(44100 * 2); // Read 1 second (stereo)
    console.log(`   Requested: ${44100 * 2} samples`);
    console.log(`   Read: ${result.samplesRead} samples`);
    console.log(`   Buffer type: ${result.buffer.constructor.name}`);
    console.log(`   Buffer length: ${result.buffer.length}`);
    
    if (result.samplesRead > 0) {
        console.log('✓ Successfully read samples');
    } else {
        console.error('❌ Failed to read samples');
    }
    
    // Test 4: Seek
    console.log('\n4. Testing seek...');
    const seekPos = Math.min(5.0, decoder.getDuration() / 2);
    const seekSuccess = decoder.seek(seekPos);
    console.log(`   Seek to ${seekPos.toFixed(2)}s: ${seekSuccess ? '✓' : '❌'}`);
    
    // Test 5: Read after seek
    console.log('\n5. Reading after seek...');
    const result2 = decoder.read(4410 * 2); // Read 0.1 second
    console.log(`   Read: ${result2.samplesRead} samples`);
    console.log(result2.samplesRead > 0 ? '✓' : '❌');
    
    // Test 6: Close
    console.log('\n6. Closing decoder...');
    decoder.close();
    console.log(`   Is Open: ${decoder.isOpen()}`);
    console.log('✓ Decoder closed');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
}

runTests().catch(err => {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
});
