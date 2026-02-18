import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, '..', '..', 'shared-data', 'Building Address References.csv');
const buildingsPath = join(__dirname, '..', 'data', 'buildings.ts');

// Parse CSV
const csvContent = readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',');

const csvBuildings = [];
for (let i = 1; i < lines.length; i++) {
  // Handle CSV parsing with potential commas in addresses
  const matches = lines[i].match(/(".*?"|[^,]+)/g);
  if (!matches) continue;
  const values = matches.map(v => v.replace(/^"|"$/g, '').trim());

  const obj = {};
  headers.forEach((h, idx) => {
    obj[h.trim()] = values[idx] || '';
  });

  if (obj['Apartment/Condo'] === 'Condo') {
    csvBuildings.push(obj);
  }
}

// Mapping from CSV Property name to buildings.ts slug
const nameToSlug = {
  "Austin Proper": "austin-proper-residences",
  "Four Seasons": "four-seasons-residences",
  "The Modern": "the-modern-austin",
  "The Austonian": "the-austonian",
  "W Residences": "the-w-residences",
  "The Independent": "the-independent",
  "70 Rainey": "70-rainey",
  "Seaholm Residences": "seaholm-residences",
  "44 East": "44-east",
  "5th & West": "5th-and-west",
  "Nokonah": "nokonah",
  "360 Condos": "360-condominiums",
  "Spring Condos": "spring-condominiums",
  "904 West Condos": "904-west",
  "The Shore": "the-shore-condominiums",
  "Five Fifty 05": "5-fifty-five",
  "Austin City Lofts": "austin-city-lofts",
  "Cambridge Tower": "cambridge-tower",
  "Celias Court": "celias-court",
  "Milago": "milago",
  "Sabine on 5th": "sabine-on-5th",
  "Brazos Place": "brazos-place",
  "Towers of Town Lake": "the-towers-of-town-lake",
};

// Extract street address from full CSV address (strip city/state/zip/country)
function extractStreet(fullAddr) {
  // Remove ", Austin, TX 78701" or similar suffix, and optional ", USA"
  return fullAddr
    .replace(/,\s*USA\s*$/i, '')
    .replace(/,\s*Austin,\s*TX\s*\d{5}.*$/i, '')
    .trim();
}

let buildingsContent = readFileSync(buildingsPath, 'utf-8');
let changeCount = 0;

for (const csv of csvBuildings) {
  const slug = nameToSlug[csv.Property];
  if (!slug) continue;

  const street = extractStreet(csv.Address);
  const lat = parseFloat(csv.Lat);
  const lng = parseFloat(csv.Lng);
  const floors = parseInt(csv.Floors);
  const units = parseInt(csv.Units);
  const year = parseInt(csv['Year Completed']);

  // Find the building block in the file by slug
  const slugPattern = new RegExp(`slug: "${slug}"`);
  if (!slugPattern.test(buildingsContent)) {
    console.log(`  SKIP: slug "${slug}" not found in buildings.ts`);
    continue;
  }

  // Find the section for this building (between its slug and the next building or end)
  const slugIdx = buildingsContent.indexOf(`slug: "${slug}"`);
  // Find the start of the building object (go back to find the opening {)
  let blockStart = buildingsContent.lastIndexOf('  {', slugIdx);
  // Find the end - look for the next "  {" with name: pattern or end of array
  let nextBlockStart = buildingsContent.indexOf('\n  {', slugIdx + 10);
  if (nextBlockStart === -1) nextBlockStart = buildingsContent.indexOf('\n];', slugIdx);

  let block = buildingsContent.substring(blockStart, nextBlockStart);
  let newBlock = block;

  // Update address
  const addrMatch = newBlock.match(/address: "([^"]+)"/);
  if (addrMatch && addrMatch[1] !== street) {
    console.log(`${slug}: address "${addrMatch[1]}" → "${street}"`);
    newBlock = newBlock.replace(`address: "${addrMatch[1]}"`, `address: "${street}"`);
    changeCount++;
  }

  // Update coordinates
  const coordMatch = newBlock.match(/coordinates: \{ lat: ([\d.-]+), lng: ([\d.-]+) \}/);
  if (coordMatch) {
    const oldLat = parseFloat(coordMatch[1]);
    const oldLng = parseFloat(coordMatch[2]);
    if (Math.abs(oldLat - lat) > 0.0001 || Math.abs(oldLng - lng) > 0.0001) {
      console.log(`${slug}: coords (${oldLat}, ${oldLng}) → (${lat}, ${lng})`);
      newBlock = newBlock.replace(
        `coordinates: { lat: ${coordMatch[1]}, lng: ${coordMatch[2]} }`,
        `coordinates: { lat: ${lat}, lng: ${lng} }`
      );
      changeCount++;
    }
  }

  // Update floors
  const floorsMatch = newBlock.match(/floors: (\d+)/);
  if (floorsMatch && parseInt(floorsMatch[1]) !== floors) {
    console.log(`${slug}: floors ${floorsMatch[1]} → ${floors}`);
    newBlock = newBlock.replace(`floors: ${floorsMatch[1]}`, `floors: ${floors}`);
    changeCount++;
  }

  // Update units
  const unitsMatch = newBlock.match(/units: (\d+)/);
  if (unitsMatch && parseInt(unitsMatch[1]) !== units) {
    console.log(`${slug}: units ${unitsMatch[1]} → ${units}`);
    newBlock = newBlock.replace(`units: ${unitsMatch[1]}`, `units: ${units}`);
    changeCount++;
  }

  // Update yearBuilt
  const yearMatch = newBlock.match(/yearBuilt: (\d+)/);
  if (yearMatch && parseInt(yearMatch[1]) !== year) {
    console.log(`${slug}: yearBuilt ${yearMatch[1]} → ${year}`);
    newBlock = newBlock.replace(`yearBuilt: ${yearMatch[1]}`, `yearBuilt: ${year}`);
    changeCount++;
  }

  if (block !== newBlock) {
    buildingsContent = buildingsContent.replace(block, newBlock);
  }
}

writeFileSync(buildingsPath, buildingsContent);
console.log(`\nDone! Made ${changeCount} field updates.`);
