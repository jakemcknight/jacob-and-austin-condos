import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the CSV file
const csvPath = '/Users/jacobhannusch/Downloads/Downtown Condo Database - Condo Buildings.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV (simple parsing - assumes no commas in quoted fields that we care about)
const lines = csvContent.split('\n');
const headers = lines[0].split(',');

// Find column indices
const getColIndex = (name) => headers.findIndex(h => h.trim() === name);

const nameIdx = getColIndex('Building Name');
const addressIdx = getColIndex('Address');
const yearIdx = getColIndex('Year Completed');
const floorsIdx = getColIndex('Floors');
const unitsIdx = getColIndex('Units');
const architectIdx = getColIndex('Architect');
const developerIdx = getColIndex('Developer');

console.log('Column indices:', {
  nameIdx,
  addressIdx,
  yearIdx,
  floorsIdx,
  unitsIdx,
  architectIdx,
  developerIdx
});

// Parse building data from CSV
const buildingsMap = new Map();

for (let i = 2; i < lines.length; i++) { // Start at 2 to skip header and empty row
  const line = lines[i].trim();
  if (!line) continue;

  // Simple CSV split (won't handle all edge cases but should work for this data)
  const parts = line.split(',');

  const name = parts[nameIdx]?.replace(/"/g, '').trim();
  if (!name || name === '-') continue;

  const address = parts[addressIdx]?.replace(/"/g, '').trim();
  const year = parts[yearIdx]?.trim();
  const floors = parts[floorsIdx]?.trim();
  const units = parts[unitsIdx]?.trim();
  const architect = parts[architectIdx]?.replace(/"/g, '').trim();
  const developer = parts[developerIdx]?.replace(/"/g, '').trim();

  buildingsMap.set(name, {
    name,
    address,
    yearBuilt: year && year !== '-' ? parseInt(year) : null,
    floors: floors && floors !== '-' ? parseInt(floors) : null,
    units: units && units !== '-' ? parseInt(units) : null,
    architect: architect || '',
    developer: developer || ''
  });
}

console.log('\nParsed buildings from CSV:');
console.log(Array.from(buildingsMap.keys()).sort());

// Create a mapping of building names to data
const updates = {
  'The Modern Austin': buildingsMap.get('The Modern'),
  '44 East': buildingsMap.get('44 East'),
  'The Independent': buildingsMap.get('The Independent'),
  '70 Rainey': buildingsMap.get('70 Rainey'),
  'Four Seasons': buildingsMap.get('Four Seasons'),
  'The Austonian': buildingsMap.get('The Austonian'),
  'W Residences': buildingsMap.get('W Residences'),
  '360 Condominiums': buildingsMap.get('360 Condos'),
  'Spring Condos': buildingsMap.get('Spring Condos'),
  'Seaholm Residences': buildingsMap.get('Seaholm Residences'),
  'Natiivo': buildingsMap.get('Natiivo'),
  '5th & West': buildingsMap.get('5th & West'),
  'Austin City Lofts': buildingsMap.get('Austin City Lofts'),
  'Nokonah': buildingsMap.get('Nokonah'),
  'The Shore': buildingsMap.get('The Shore'),
  'Milago': buildingsMap.get('Milago'),
  'Five Fifty 05': buildingsMap.get('Five Fifty 05'),
  'Sabine on 5th': buildingsMap.get('Sabine on 5th'),
  'Brown Building': buildingsMap.get('Brown Building'),
  'Austin Proper': buildingsMap.get('Austin Proper'),
  'Vesper': buildingsMap.get('Vesper'),
  'The Linden': buildingsMap.get('The Linden'),
  'Penthouse Condos': buildingsMap.get('Penthouse Condos'),
  'Brazos Place': buildingsMap.get('Brazos Place'),
  'Westgate Tower': buildingsMap.get('Westgate Tower'),
  'Plaza Lofts': buildingsMap.get('Plaza Lofts'),
};

console.log('\nUpdates to apply:');
for (const [key, value] of Object.entries(updates)) {
  if (value) {
    console.log(`${key}:`);
    console.log(`  Year: ${value.yearBuilt || 'N/A'}`);
    console.log(`  Floors: ${value.floors || 'N/A'}`);
    console.log(`  Units: ${value.units || 'N/A'}`);
    console.log(`  Architect: ${value.architect || 'N/A'}`);
    console.log(`  Developer: ${value.developer || 'N/A'}`);
  } else {
    console.log(`${key}: NO MATCH FOUND`);
  }
}

// Write the updates to a JSON file for reference
fs.writeFileSync(
  path.join(__dirname, 'csv-updates.json'),
  JSON.stringify(updates, null, 2)
);

console.log('\nWrote updates to csv-updates.json');
