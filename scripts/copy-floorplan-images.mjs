#!/usr/bin/env node

/**
 * Copy floor plan images from floorplan-data project to jacob-and-austin-condos
 * Maps source directory names to destination building slugs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_BASE = '/Users/jacobhannusch/Documents/floorplan-data/public/floorplans/downtown-austin';
const DEST_BASE = path.join(__dirname, '..', 'public', 'floorplans');

// Map source directory names to destination building slugs
const DIRECTORY_MAP = {
  '360-condos': '360-condominiums',
  '44-east': '44-east',
  '5th--west': '5th-and-west',
  '70-rainey': '70-rainey',
  'austin-city-lofts': 'austin-city-lofts',
  'austin-proper': 'austin-proper-residences',
  'four-seasons': 'four-seasons-residences',
  'milago': 'milago',
  'natiivo': 'natiivo',
  'sabine-on-5th': 'sabine-on-5th',
  'seaholm-residences': 'seaholm-residences',
  'spring-condos': 'spring-condominiums',
  'the-austonian': 'the-austonian',
  'the-independent': 'the-independent',
  'the-linden': 'the-linden',
  'the-modern': 'the-modern-austin',
  'the-shore': 'the-shore-condominiums',
};

async function copyFloorPlanImages() {
  console.log('🖼️  Copying floor plan images...\n');

  let totalCopied = 0;
  let totalSkipped = 0;
  let errors = 0;

  // Ensure destination base directory exists
  if (!fs.existsSync(DEST_BASE)) {
    fs.mkdirSync(DEST_BASE, { recursive: true });
  }

  // Process each building
  for (const [sourceDir, destDir] of Object.entries(DIRECTORY_MAP)) {
    const sourcePath = path.join(SOURCE_BASE, sourceDir);
    const destPath = path.join(DEST_BASE, destDir);

    // Check if source directory exists
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Source not found: ${sourceDir}`);
      continue;
    }

    // Create destination directory
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    // Read all files in source directory
    const files = fs.readdirSync(sourcePath);
    const imageFiles = files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));

    if (imageFiles.length === 0) {
      console.log(`⚠️  No images in: ${sourceDir}`);
      continue;
    }

    console.log(`📁 ${destDir} (${imageFiles.length} images)`);

    // Copy each image
    for (const file of imageFiles) {
      const sourceFile = path.join(sourcePath, file);
      const destFile = path.join(destPath, file);

      try {
        fs.copyFileSync(sourceFile, destFile);
        console.log(`   ✓ ${file}`);
        totalCopied++;
      } catch (error) {
        console.error(`   ✗ ${file}: ${error.message}`);
        errors++;
      }
    }

    console.log('');
  }

  console.log('📊 Summary:');
  console.log(`   ✓ Copied: ${totalCopied} images`);
  if (errors > 0) {
    console.log(`   ✗ Errors: ${errors}`);
  }
  console.log('');
  console.log('✅ Done!');
}

copyFloorPlanImages().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
