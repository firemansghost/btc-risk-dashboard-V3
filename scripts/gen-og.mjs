#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function generateOgPng() {
  try {
    console.log('Generating OG PNG from SVG...');
    
    const svgPath = join(projectRoot, 'public', 'og-default.svg');
    const pngPath = join(projectRoot, 'public', 'og-default.png');
    
    // Check if SVG exists
    try {
      await fs.access(svgPath);
    } catch (error) {
      console.error(`SVG file not found: ${svgPath}`);
      process.exit(1);
    }
    
    // Read SVG and convert to PNG
    const svgBuffer = await fs.readFile(svgPath);
    
    await sharp(svgBuffer)
      .resize(1200, 630, {
        fit: 'contain',
        background: { r: 15, g: 23, b: 42, alpha: 1 } // slate-900 background
      })
      .png({
        quality: 100,
        compressionLevel: 6
      })
      .toFile(pngPath);
    
    console.log(`✅ Generated ${pngPath} (1200×630)`);
    
    // Verify the file was created
    const stats = await fs.stat(pngPath);
    console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error('❌ Error generating OG PNG:', error.message);
    process.exit(1);
  }
}

generateOgPng();
