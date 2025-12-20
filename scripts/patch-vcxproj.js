/**
 * Patch node-gyp generated vcxproj files to use MSVC v142 instead of ClangCL
 * This ensures compatibility with Visual Studio 2019/2022 build tools
 * 
 * Based on: LibreHardwareMonitor_NativeNodeIntegration/NativeLibremon_NAPI/patch-vcxproj.js
 */

const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, 'build');

function patchVcxproj(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace ClangCL with MSVC v143
    if (content.includes('<PlatformToolset>ClangCL</PlatformToolset>')) {
        content = content.replace(
            /<PlatformToolset>ClangCL<\/PlatformToolset>/g,
            '<PlatformToolset>v143</PlatformToolset>'
        );
        modified = true;
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Patched: ${path.relative(buildDir, filePath)}`);
    }
}

function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            walkDir(fullPath);
        } else if (entry.name.endsWith('.vcxproj')) {
            patchVcxproj(fullPath);
        }
    }
}

if (!fs.existsSync(buildDir)) {
    console.log('No build directory found, skipping patch');
    process.exit(0);
}

console.log('Patching vcxproj files to use MSVC v142...');
walkDir(buildDir);
console.log('Patching complete.');
