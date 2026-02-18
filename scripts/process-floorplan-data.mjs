#!/usr/bin/env node

/**
 * Floor Plan Data Processing Script
 *
 * This script:
 * 1. Reads the master CSV from floorplan-data project
 * 2. Auto-generates building name mapping using fuzzy matching
 * 3. Transforms CSV records to FloorPlan objects
 * 4. Generates new floorPlans.ts data file
 * 5. Copies images from floorplan-data to jacob-and-austin-condos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CSV_PATH = '/Users/jacobhannusch/Documents/floorplan-data/Downtown Floor Plans - All Floor Plans - AI (1).csv';
const IMAGE_SOURCE = '/Users/jacobhannusch/Documents/floorplan-data/public/floorplans/downtown-austin';
const PROJECT_ROOT = path.join(__dirname, '..');
const IMAGE_DEST = path.join(PROJECT_ROOT, 'public/floorplans');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'data/floorPlans.ts');
const BUILDINGS_FILE = path.join(PROJECT_ROOT, 'data/buildings.ts');

// Manual building name mappings for abbreviated CSV names
// These override fuzzy matching for cases where CSV uses shortened names
const MANUAL_BUILDING_MAP = {
  '360 Condos': '360-condominiums',
  '44 East': '44-east',
  'Austin Proper': 'austin-proper-residences',
  'Four Seasons': 'four-seasons-residences',
  'Spring Condos': 'spring-condominiums',
  'The Modern': 'the-modern-austin',
  'The Shore': 'the-shore-condominiums',
  'W Residences': 'the-w-residences',
};

/**
 * Simple CSV parser
 */
function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = parseLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseLine(lines[i]);
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[index] || '';
      });
      records.push(record);
    }
  }

  return records;
}

/**
 * Parse a single CSV line (handles quoted values)
 */
function parseLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

/**
 * Normalize string for fuzzy matching
 */
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance for fuzzy string matching
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1)
 */
function similarity(str1, str2) {
  const normalized1 = normalize(str1);
  const normalized2 = normalize(str2);
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  return 1 - distance / maxLength;
}

/**
 * Extract building names and slugs from buildings.ts
 */
function extractBuildingsFromTS() {
  const content = fs.readFileSync(BUILDINGS_FILE, 'utf-8');

  // Extract name and slug pairs
  const buildings = [];
  const nameMatches = content.matchAll(/name:\s*"([^"]+)"/g);
  const slugMatches = content.matchAll(/slug:\s*"([^"]+)"/g);

  const names = Array.from(nameMatches).map(m => m[1]);
  const slugs = Array.from(slugMatches).map(m => m[1]);

  for (let i = 0; i < Math.min(names.length, slugs.length); i++) {
    buildings.push({ name: names[i], slug: slugs[i] });
  }

  return buildings;
}

/**
 * Auto-generate building name mapping using fuzzy matching
 */
function generateBuildingNameMap(csvBuildingNames, websiteBuildings) {
  const map = {};
  const unmapped = [];

  for (const csvName of csvBuildingNames) {
    // Check manual mapping first
    if (MANUAL_BUILDING_MAP[csvName]) {
      map[csvName] = MANUAL_BUILDING_MAP[csvName];
      console.log(`✓ Mapped "${csvName}" → ${MANUAL_BUILDING_MAP[csvName]} [manual mapping]`);
      continue;
    }

    // Fallback to fuzzy matching
    let bestMatch = null;
    let bestScore = 0;

    for (const building of websiteBuildings) {
      const score = similarity(csvName, building.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = building;
      }
    }

    // Use 80% similarity threshold
    if (bestScore >= 0.8 && bestMatch) {
      map[csvName] = bestMatch.slug;
      console.log(`✓ Mapped "${csvName}" → "${bestMatch.name}" (${bestMatch.slug}) [${(bestScore * 100).toFixed(1)}% match]`);
    } else {
      unmapped.push({ csvName, bestMatch, bestScore });
      console.warn(`⚠ No confident match for "${csvName}" (best: "${bestMatch?.name}" at ${(bestScore * 100).toFixed(1)}%)`);
    }
  }

  if (unmapped.length > 0) {
    console.log('\n❗ Review these unmapped buildings:');
    unmapped.forEach(({ csvName, bestMatch, bestScore }) => {
      console.log(`   "${csvName}" → best guess: "${bestMatch?.name}" (${(bestScore * 100).toFixed(1)}%)`);
    });
    console.log('\nYou may need to add manual mappings to the script for these buildings.\n');
  }

  return map;
}

/**
 * Create floor plan slug for SEO-friendly URL
 */
function createFloorPlanSlug(record) {
  const name = record['Floor Plan'].toLowerCase().replace(/[^a-z0-9]/g, '');
  const bed = record.Bed;
  const sqft = record.SF;
  return `${name}-${bed}br-${sqft}sf-floorplan`;
}

/**
 * Process CSV data into floor plans grouped by building
 * Deduplicates floor plans with the same name within each building
 */
function processCSVData(records, buildingNameMap) {
  const floorPlansByBuilding = new Map();
  const skipped = [];

  // First pass: collect all floor plans by building and name
  const buildingFloorPlanMap = new Map();

  for (const record of records) {
    const buildingSlug = buildingNameMap[record.Building];

    if (!buildingSlug) {
      skipped.push(record.Building);
      continue;
    }

    const floorPlanName = record['Floor Plan'];
    const key = `${buildingSlug}::${floorPlanName}`;

    const floorPlanSlug = createFloorPlanSlug(record);

    const floorPlan = {
      name: floorPlanName,
      bedrooms: parseInt(record.Bed) || 0,
      bathrooms: parseFloat(record.Bath) || 0,
      hasStudy: record.Study?.toLowerCase() === 'yes',
      sqft: parseInt(record.SF) || 0,
      orientation: '', // Hidden per user request
      unitNumbers: '', // Hidden per user request
      quantity: parseInt(record.Quantity) || 0,
      imageUrl: `/floorplans/${buildingSlug}/${floorPlanSlug}.png`,
      slug: floorPlanSlug,
    };

    if (!buildingFloorPlanMap.has(key)) {
      buildingFloorPlanMap.set(key, floorPlan);
    } else {
      // Aggregate quantities for duplicate floor plans
      const existing = buildingFloorPlanMap.get(key);
      existing.quantity += floorPlan.quantity;
    }
  }

  // Second pass: organize by building
  for (const [key, floorPlan] of buildingFloorPlanMap) {
    const buildingSlug = key.split('::')[0];

    if (!floorPlansByBuilding.has(buildingSlug)) {
      floorPlansByBuilding.set(buildingSlug, []);
    }
    floorPlansByBuilding.get(buildingSlug).push(floorPlan);
  }

  // Sort floor plans within each building by name
  for (const [buildingSlug, plans] of floorPlansByBuilding) {
    plans.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (skipped.length > 0) {
    const uniqueSkipped = [...new Set(skipped)];
    console.log(`\n⚠ Skipped ${uniqueSkipped.length} buildings due to no mapping:`);
    uniqueSkipped.forEach(name => console.log(`   - ${name}`));
  }

  return floorPlansByBuilding;
}

/**
 * Generate TypeScript file content
 */
function generateFloorPlansTypeScript(floorPlansByBuilding) {
  let output = `// Auto-generated by scripts/process-floorplan-data.mjs
// DO NOT EDIT MANUALLY - changes will be overwritten
// Source: ${CSV_PATH}

export interface FloorPlan {
  name: string;
  bedrooms: number;
  bathrooms: number;
  hasStudy: boolean;
  sqft: number;
  orientation: string;
  unitNumbers: string;
  quantity: number;
  imageUrl: string;
  slug: string;
}

export const floorPlans: Record<string, FloorPlan[]> = {
`;

  const sortedEntries = Array.from(floorPlansByBuilding.entries()).sort();

  for (const [buildingSlug, plans] of sortedEntries) {
    output += `  "${buildingSlug}": [\n`;

    for (const plan of plans) {
      output += `    {\n`;
      output += `      name: "${plan.name}",\n`;
      output += `      bedrooms: ${plan.bedrooms},\n`;
      output += `      bathrooms: ${plan.bathrooms},\n`;
      output += `      hasStudy: ${plan.hasStudy},\n`;
      output += `      sqft: ${plan.sqft},\n`;
      output += `      orientation: "${plan.orientation}",\n`;
      output += `      unitNumbers: "${plan.unitNumbers}",\n`;
      output += `      quantity: ${plan.quantity},\n`;
      output += `      imageUrl: "${plan.imageUrl}",\n`;
      output += `      slug: "${plan.slug}",\n`;
      output += `    },\n`;
    }

    output += `  ],\n`;
  }

  output += `};\n`;

  return output;
}

/**
 * Copy floor plan images with SEO-friendly names
 */
function copyFloorPlanImages(floorPlansByBuilding) {
  console.log('\n📸 Copying floor plan images...');

  let copied = 0;
  let missing = 0;

  for (const [buildingSlug, floorPlans] of floorPlansByBuilding) {
    const destDir = path.join(IMAGE_DEST, buildingSlug);

    // Create directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    for (const fp of floorPlans) {
      // Try to find the source image
      // Images might be in various formats, try a few possibilities
      const possibleNames = [
        `${fp.slug}.png`,
        `${fp.slug}.jpg`,
        `${fp.slug}.jpeg`,
      ];

      let sourcePath = null;
      for (const name of possibleNames) {
        const testPath = path.join(IMAGE_SOURCE, buildingSlug, name);
        if (fs.existsSync(testPath)) {
          sourcePath = testPath;
          break;
        }
      }

      if (sourcePath) {
        const destPath = path.join(destDir, `${fp.slug}.png`);
        fs.copyFileSync(sourcePath, destPath);
        copied++;
        console.log(`  ✓ ${buildingSlug}/${fp.slug}.png`);
      } else {
        missing++;
        console.warn(`  ✗ Missing: ${buildingSlug}/${fp.slug}.png`);
      }
    }
  }

  console.log(`\n📊 Image copy summary: ${copied} copied, ${missing} missing`);

  return { copied, missing };
}

/**
 * Main execution
 */
async function main() {
  console.log('🏢 Floor Plan Data Processing Script\n');
  console.log('=' .repeat(60));

  // Step 1: Verify CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found: ${CSV_PATH}`);
    process.exit(1);
  }

  // Step 2: Extract buildings from buildings.ts
  console.log('\n📖 Reading buildings from buildings.ts...');
  const websiteBuildings = extractBuildingsFromTS();
  console.log(`   Found ${websiteBuildings.length} buildings`);

  // Step 3: Read and parse CSV
  console.log('\n📖 Reading CSV file...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parseCSV(csvContent);
  console.log(`   Found ${records.length} floor plan records`);

  // Step 4: Extract unique building names from CSV
  const csvBuildingNames = [...new Set(records.map(r => r.Building))].sort();
  console.log(`   Found ${csvBuildingNames.length} unique buildings in CSV`);

  // Step 5: Generate building name mapping
  console.log('\n🔗 Generating building name mapping...');
  const buildingNameMap = generateBuildingNameMap(csvBuildingNames, websiteBuildings);
  console.log(`   Mapped ${Object.keys(buildingNameMap).length} buildings`);

  // Step 6: Process CSV data
  console.log('\n⚙️  Processing floor plan data...');
  const floorPlansByBuilding = processCSVData(records, buildingNameMap);
  console.log(`   Processed ${floorPlansByBuilding.size} buildings with floor plans`);

  // Step 7: Generate TypeScript file
  console.log('\n📝 Generating floorPlans.ts...');
  const tsContent = generateFloorPlansTypeScript(floorPlansByBuilding);
  fs.writeFileSync(OUTPUT_FILE, tsContent);
  console.log(`   ✓ Written to ${OUTPUT_FILE}`);

  // Step 8: Copy images
  if (fs.existsSync(IMAGE_SOURCE)) {
    const { copied, missing } = copyFloorPlanImages(floorPlansByBuilding);

    if (missing > 0) {
      console.log(`\n⚠️  ${missing} images are missing. You may need to:`);
      console.log('   1. Check the source directory structure');
      console.log('   2. Verify image filenames match the expected pattern');
      console.log('   3. Run the floorplan-data project to generate missing images');
    }
  } else {
    console.warn(`\n⚠️  Image source directory not found: ${IMAGE_SOURCE}`);
    console.warn('   Images will not be copied. Run this script after images are generated.');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Floor plan data processing complete!');
  console.log('\nNext steps:');
  console.log('1. Review the generated floorPlans.ts file');
  console.log('2. Check for any unmapped buildings and add manual mappings if needed');
  console.log('3. Verify images were copied correctly');
  console.log('4. Run the website build: npm run build');
  console.log('=' .repeat(60) + '\n');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
