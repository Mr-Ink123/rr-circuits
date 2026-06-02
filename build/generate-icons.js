#!/usr/bin/env node
/**
 * generate-icons.js
 * Run this once to generate icon files from icon.svg:
 *   node build/generate-icons.js
 *
 * Requires: npm install sharp @electron/packager (install once, not in devDeps)
 * Or use an online converter:
 *   ICO  → https://icoconvert.com
 *   ICNS → https://cloudconvert.com/png-to-icns
 */

const path = require('path');
const fs   = require('fs');

async function run() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('Installing sharp for icon generation...');
    require('child_process').execSync('npm install sharp --no-save', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const svg  = fs.readFileSync(path.join(__dirname, 'icon.svg'));
  const out  = __dirname;
  const iconDir = path.join(out, 'icons');
  if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

  // Linux: multiple PNG sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(iconDir, `${size}x${size}.png`));
    console.log(`✓ icons/${size}x${size}.png`);
  }

  // Main PNG (512x512 for Linux + fallback)
  await sharp(svg).resize(512, 512).png().toFile(path.join(out, 'icon.png'));
  console.log('✓ icon.png');

  // For ICO and ICNS you need separate tools — see comments above
  console.log('\nNext steps:');
  console.log('  ICO  (Windows): convert build/icon.png at https://icoconvert.com → save as build/icon.ico');
  console.log('  ICNS (macOS):   convert build/icons/512x512.png at https://cloudconvert.com → save as build/icon.icns');
  console.log('\nOr with ImageMagick:');
  console.log('  convert build/icon.png -resize 256x256 build/icon.ico');
  console.log('  png2icns build/icon.icns build/icons/*.png');
}

run().catch(console.error);
