#!/usr/bin/env node
/**
 * Export enriched condo evaluation dataset as CSV
 *
 * Combines:
 * 1. Raw MLS CSV imports (historical closed/active/pending data)
 * 2. Unit lookup enrichment (floor plan + orientation per unit)
 * 3. Floor plan specs (canonical sqft, beds, baths per plan)
 * 4. Building metadata (address, year built, floors, units)
 *
 * Output: A flat CSV with all fields needed for pricing evaluation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Simple CSV parser/writer (no dependencies) ───────────────────────────

function* parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQuotes) {
      lines.push(current);
      current = '';
      if (ch === '\r') i++; // skip \n after \r
      // Yield a row
      if (lines.length > 0) yield lines.splice(0);
    } else if (ch === '\r' && !inQuotes) {
      lines.push(current);
      current = '';
      if (lines.length > 0) yield lines.splice(0);
    } else {
      current += ch;
    }
  }
  if (current || lines.length > 0) {
    lines.push(current);
    yield lines;
  }
}

function* parseCSVWithHeaders(text) {
  let headers = null;
  for (const row of parseCSV(text)) {
    if (!headers) {
      headers = row;
      continue;
    }
    if (row.length === 1 && row[0] === '') continue; // skip empty lines
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i] || '';
    }
    yield obj;
  }
}

function escapeCSVField(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function writeCSV(rows, columns) {
  const header = columns.map(escapeCSVField).join(',');
  const lines = [header];
  for (const row of rows) {
    lines.push(columns.map(col => escapeCSVField(row[col])).join(','));
  }
  return lines.join('\n');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─── Load enrichment data from TS files ────────────────────────────────────

function loadTsExport(filePath, exportName) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Strip TypeScript type annotations and imports, evaluate as JS
  const cleaned = content
    .replace(/export\s+interface\s+\w+\s*\{[^}]*\}/g, '')
    .replace(/export\s+type\s+[^;]+;/g, '')
    .replace(/:\s*Record<[^>]+>/g, '')
    .replace(/:\s*\w+(\[\])?\s*=/g, ' =')
    .replace(/export\s+const\s+/, 'const ')
    .replace(/:\s*(string|number|boolean)(\[\])?\s*[;,]/g, ';');

  // Use Function constructor to evaluate
  const fn = new Function(`${cleaned}\nreturn ${exportName};`);
  return fn();
}

// Load unit lookup: buildingSlug → unitNumber → { floorPlan, orientation, floorPlanSlug }
const unitLookupPath = path.join(ROOT, 'data', 'unitLookup.ts');
const unitLookupContent = fs.readFileSync(unitLookupPath, 'utf-8');
const unitLookup = {};

// Line-based parsing for nested structure
{
  let currentBuilding = null;
  for (const line of unitLookupContent.split('\n')) {
    // Match building slug line: "360-condominiums": {
    const bldgMatch = line.match(/^\s+"([a-z0-9-]+)":\s*\{$/);
    if (bldgMatch) {
      currentBuilding = bldgMatch[1];
      unitLookup[currentBuilding] = {};
      continue;
    }
    // Match unit line: "901": { floorPlan: "A9", orientation: "SEc", floorPlanSlug: "..." },
    if (currentBuilding) {
      const unitMatch = line.match(/^\s+"(\w+)":\s*\{\s*floorPlan:\s*"([^"]*)",\s*orientation:\s*"([^"]*)",\s*floorPlanSlug:\s*"([^"]*)"/);
      if (unitMatch) {
        unitLookup[currentBuilding][unitMatch[1]] = {
          floorPlan: unitMatch[2],
          orientation: unitMatch[3],
          floorPlanSlug: unitMatch[4],
        };
      }
    }
    // Close building block
    if (line.match(/^\s+\},?\s*$/) && currentBuilding) {
      // Check if this closes a unit entry (short line) vs building block
      // Building blocks have higher indent level, but we can just let it naturally handle
    }
  }
}

// Log unitLookup stats
{
  let totalUnits = 0;
  for (const [slug, units] of Object.entries(unitLookup)) {
    const count = Object.keys(units).length;
    if (count > 0) totalUnits += count;
  }
  console.log(`Loaded unitLookup: ${Object.keys(unitLookup).length} buildings, ${totalUnits} units`);
}

// Load floor plans: buildingSlug → FloorPlan[]
const floorPlansPath = path.join(ROOT, 'data', 'floorPlans.ts');
const floorPlansContent = fs.readFileSync(floorPlansPath, 'utf-8');
const floorPlansByBuilding = {};

// Parse floor plans - extract name and sqft for each building
const fpBuildingRegex = /"([^"]+)":\s*\[([\s\S]*?)\],?\s*(?="[^"]+":|\};)/g;
let fpBuildingMatch;
while ((fpBuildingMatch = fpBuildingRegex.exec(floorPlansContent)) !== null) {
  const slug = fpBuildingMatch[1];
  const plansBlock = fpBuildingMatch[2];
  floorPlansByBuilding[slug] = {};

  const planRegex = /name:\s*"([^"]*)"[\s\S]*?bedrooms:\s*(\d+)[\s\S]*?bathrooms:\s*(\d+)[\s\S]*?hasStudy:\s*(true|false)[\s\S]*?sqft:\s*(\d+)/g;
  let planMatch;
  while ((planMatch = planRegex.exec(plansBlock)) !== null) {
    floorPlansByBuilding[slug][planMatch[1]] = {
      bedrooms: parseInt(planMatch[2]),
      bathrooms: parseInt(planMatch[3]),
      hasStudy: planMatch[4] === 'true',
      sqft: parseInt(planMatch[5]),
    };
  }
}

// Load buildings: slug → building metadata
const buildingsPath = path.join(ROOT, 'data', 'buildings.ts');
const buildingsContent = fs.readFileSync(buildingsPath, 'utf-8');
const buildingsBySlug = {};
const buildingsBySubdivision = {}; // For matching CSV Subdivision → slug

const bldgRegex = /slug:\s*"([^"]*)"[\s\S]*?address:\s*"([^"]*)"[\s\S]*?floors:\s*(\d+)[\s\S]*?units:\s*(\d+)[\s\S]*?yearBuilt:\s*(\d+)/g;
const bldgNameRegex = /name:\s*"([^"]*)"[\s\S]*?slug:\s*"([^"]*)"/g;
let bldgNameMatch;
while ((bldgNameMatch = bldgNameRegex.exec(buildingsContent)) !== null) {
  const name = bldgNameMatch[1];
  const slug = bldgNameMatch[2];
  buildingsBySlug[slug] = { name, slug };
  // Also index by lowercased name for fuzzy matching
  buildingsBySubdivision[name.toLowerCase()] = slug;
}

// Add common subdivision name → slug mappings
const subdivisionAliases = {
  '360 condominiums': '360-condominiums',
  '360 residences': '360-condominiums',
  'the independent': 'the-independent',
  'independent': 'the-independent',
  'spring condominium': 'spring',
  'spring condominiums': 'spring',
  'seaholm residences': 'seaholm-residences',
  'austonian': 'the-austonian',
  'the austonian': 'the-austonian',
  'the bowie': 'the-bowie',
  'bowie': 'the-bowie',
  'four seasons residences': 'four-seasons-residences',
  'w residences': 'w-austin-residences',
  'w austin residences': 'w-austin-residences',
  'the shore condos': 'the-shore',
  'shore condos': 'the-shore',
  'milago': 'milago',
  'milago condominiums': 'milago',
  'nokonah': 'nokonah',
  'nokonah condominiums': 'nokonah',
  'azure condominiums': 'azure',
  'brazos place': 'brazos-place',
  'five fifty five': 'five-fifty-five',
  '555 condominiums': 'five-fifty-five',
  'sabine on fifth': 'sabine-on-fifth',
};

for (const [alias, slug] of Object.entries(subdivisionAliases)) {
  buildingsBySubdivision[alias] = slug;
}

// ─── Load transaction history from TS file ────────────────────────────────

const transactionsPath = path.join(ROOT, 'data', 'transactions.ts');
const transactionsContent = fs.readFileSync(transactionsPath, 'utf-8');
const transactionRows = [];

// Parse transactions using line-by-line approach
{
  let currentSlug = null;
  // Match lines like:   "360-condominiums": [
  // and transaction lines like:   { date: "2009-01-30", price: 268700, ...}
  for (const line of transactionsContent.split('\n')) {
    const slugMatch = line.match(/^\s+"([a-z0-9-]+)":\s*\[$/);
    if (slugMatch) {
      currentSlug = slugMatch[1];
      continue;
    }
    if (currentSlug) {
      const txMatch = line.match(/date:\s*"([^"]*)".*?price:\s*(\d+).*?pricePerSqft:\s*(\d+).*?sqft:\s*(\d+).*?bedrooms:\s*(\d+).*?unit:\s*"([^"]*)"/);
      if (txMatch) {
        const unit = txMatch[6];
        const buildingName = buildingsBySlug[currentSlug]?.name || currentSlug;
        const enrichment = unitLookup[currentSlug]?.[unit] || {};
        const fpSpec = enrichment.floorPlan ? floorPlansByBuilding[currentSlug]?.[enrichment.floorPlan] : null;

        transactionRows.push({
          source: 'historical-transactions',
          buildingSlug: currentSlug,
          buildingName,
          unitNumber: unit,
          status: 'Closed',
          closeDate: txMatch[1],
          listingContractDate: '',
          closePrice: parseInt(txMatch[2]),
          listPrice: '',
          originalListPrice: '',
          closePricePerSqft: parseInt(txMatch[3]),
          listPricePerSqft: '',
          sqft: parseInt(txMatch[4]),
          bedrooms: parseInt(txMatch[5]),
          bathrooms: '',
          daysOnMarket: '',
          cumulativeDaysOnMarket: '',
          floorPlan: enrichment.floorPlan || '',
          orientation: enrichment.orientation || '',
          floorPlanSqft: fpSpec?.sqft || '',
          floorPlanBeds: fpSpec?.bedrooms ?? '',
          floorPlanBaths: fpSpec?.bathrooms ?? '',
          floorPlanHasStudy: fpSpec?.hasStudy ?? '',
          hoaFee: '',
          hoaFeeFrequency: '',
          yearBuilt: '',
          parkingFeatures: '',
          buyerFinancing: '',
          listAgentFullName: '',
          listOfficeName: '',
          buyerAgentFullName: '',
          buyerOfficeName: '',
          cpLp: '',
          cpOlp: '',
          listingId: '',
          address: '',
          directionFaces: enrichment.orientation || '',
          previousListPrice: '',
          mlsArea: 'DT',
        });
      }
      // End of array
      if (line.match(/^\s+\],?\s*$/)) {
        currentSlug = null;
      }
    }
  }
}

console.log(`Loaded ${transactionRows.length} historical transactions`);

// ─── Load raw MLS CSV imports ──────────────────────────────────────────────

const importsDir = path.join(ROOT, 'data', 'imports');
const csvFiles = fs.readdirSync(importsDir).filter(f => f.endsWith('.csv')).sort();
const mlsRows = [];

for (const csvFile of csvFiles) {
  const csvPath = path.join(importsDir, csvFile);
  const raw = fs.readFileSync(csvPath, 'utf-8');
  let recordCount = 0;

  for (const row of parseCSVWithHeaders(raw)) {
    recordCount++;
    const subdivision = (row['Subdivision'] || row['Building Name'] || '').trim();
    const unitNumber = (row['Unit Number'] || '').trim();

    // Match to building slug
    let buildingSlug = '';
    const subLower = subdivision.toLowerCase();
    for (const [key, slug] of Object.entries(buildingsBySubdivision)) {
      if (subLower.includes(key) || key.includes(subLower)) {
        buildingSlug = slug;
        break;
      }
    }

    // Enrichment from unitLookup
    const enrichment = buildingSlug && unitNumber ? (unitLookup[buildingSlug]?.[unitNumber] || {}) : {};
    const fpSpec = enrichment.floorPlan ? floorPlansByBuilding[buildingSlug]?.[enrichment.floorPlan] : null;

    // Also check CSV's own Floor Plan field
    const csvFloorPlan = (row['Floor Plan Name/Number'] || '').trim();
    const finalFloorPlan = enrichment.floorPlan || csvFloorPlan;

    // Orientation only from unitLookup enrichment (not MLS Direction Faces)
    const finalOrientation = enrichment.orientation || '';

    const closePrice = parseFloat((row['Close Price'] || '').replace(/[,$]/g, '')) || '';
    const listPrice = parseFloat((row['List Price'] || '').replace(/[,$]/g, '')) || '';
    const origListPrice = parseFloat((row['Original List Price'] || '').replace(/[,$]/g, '')) || '';
    const sqft = parseInt((row['SqFt'] || row['Living Area Srch Sq Ft'] || '').replace(/[,]/g, '')) || '';

    const closePsf = parseFloat((row['Close$/SqFt'] || row['CP/Bldg SqFt'] || '').replace(/[,$]/g, '')) || '';
    const listPsf = parseFloat((row['LP$/SqFt'] || '').replace(/[,$]/g, '')) || '';

    // Parse dates - normalize to YYYY-MM-DD
    const parseDate = (d) => {
      if (!d) return '';
      d = d.trim();
      // US format: MM/DD/YYYY HH:MM:SS AM/PM
      const usMatch = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (usMatch) {
        return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
      }
      // ISO format
      const isoMatch = d.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) return isoMatch[1];
      return d;
    };

    const cpLp = closePrice && listPrice ? (closePrice / listPrice).toFixed(4) : '';
    const cpOlp = closePrice && origListPrice ? (closePrice / origListPrice).toFixed(4) : '';

    mlsRows.push({
      source: 'mls-csv-import',
      buildingSlug,
      buildingName: buildingSlug ? (buildingsBySlug[buildingSlug]?.name || buildingSlug) : '',
      unitNumber,
      status: row['Standard Status'] || row['Status'] || '',
      closeDate: parseDate(row['Close Date']),
      listingContractDate: parseDate(row['Listing Contract Date']),
      closePrice,
      listPrice,
      originalListPrice: origListPrice,
      closePricePerSqft: closePsf,
      listPricePerSqft: listPsf,
      sqft,
      bedrooms: row['# Beds'] || '',
      bathrooms: row['# Baths'] || '',
      daysOnMarket: row['DOM'] || '',
      cumulativeDaysOnMarket: row['CDOM'] || '',
      floorPlan: finalFloorPlan,
      orientation: finalOrientation,
      floorPlanSqft: fpSpec?.sqft || '',
      floorPlanBeds: fpSpec?.bedrooms ?? '',
      floorPlanBaths: fpSpec?.bathrooms ?? '',
      floorPlanHasStudy: fpSpec?.hasStudy ?? '',
      hoaFee: (row['HOA Fee'] || '').replace(/[,$]/g, ''),
      hoaFeeFrequency: row['HOA Fee Frequency'] || '',
      yearBuilt: row['Year Built'] || '',
      parkingFeatures: row['Parking Features'] || '',
      buyerFinancing: row['Buyer Financing'] || '',
      listAgentFullName: row['List Agent Full Name'] || '',
      listOfficeName: row['List Office Name'] || '',
      buyerAgentFullName: row['Buyer Agent Full Name'] || '',
      buyerOfficeName: row['Buyer Office Name'] || '',
      cpLp,
      cpOlp,
      listingId: row['Listing ID'] || '',
      address: row['Address'] || '',
      directionFaces: '',
      previousListPrice: (row['Previous List Price'] || '').replace(/[,$]/g, ''),
      mlsArea: row['MLS Area'] || '',
    });
  }

  console.log(`Loaded ${recordCount} rows from ${csvFile}`);
}

console.log(`Total MLS CSV rows: ${mlsRows.length}`);

// ─── Combine and output ───────────────────────────────────────────────────

// Only keep rows that matched to one of our buildings
const allRows = [...transactionRows, ...mlsRows].filter(r => r.buildingSlug);

// Sort by building, then close/list date descending
allRows.sort((a, b) => {
  if (a.buildingSlug !== b.buildingSlug) return a.buildingSlug.localeCompare(b.buildingSlug);
  const dateA = a.closeDate || a.listingContractDate || '';
  const dateB = b.closeDate || b.listingContractDate || '';
  return dateB.localeCompare(dateA); // Descending
});

const headers = [
  'source',
  'buildingSlug',
  'buildingName',
  'unitNumber',
  'status',
  'closeDate',
  'listingContractDate',
  'closePrice',
  'listPrice',
  'originalListPrice',
  'closePricePerSqft',
  'listPricePerSqft',
  'sqft',
  'bedrooms',
  'bathrooms',
  'daysOnMarket',
  'cumulativeDaysOnMarket',
  'floorPlan',
  'orientation',
  'floorPlanSqft',
  'floorPlanBeds',
  'floorPlanBaths',
  'floorPlanHasStudy',
  'hoaFee',
  'hoaFeeFrequency',
  'yearBuilt',
  'parkingFeatures',
  'buyerFinancing',
  'listAgentFullName',
  'listOfficeName',
  'buyerAgentFullName',
  'buyerOfficeName',
  'cpLp',
  'cpOlp',
  'previousListPrice',
  'listingId',
  'address',
  'mlsArea',
];

const csv = writeCSV(allRows, headers);

const outputPath = path.join(ROOT, 'data', 'evaluation-dataset.csv');
fs.writeFileSync(outputPath, csv);
console.log(`\nWrote ${allRows.length} rows to ${outputPath}`);

// ─── Print summary stats ──────────────────────────────────────────────────

const matched = allRows.filter(r => r.buildingSlug);
const enriched = allRows.filter(r => r.floorPlan);
const closed = allRows.filter(r => r.status === 'Closed');
const active = allRows.filter(r => r.status === 'Active' || r.status === 'Active Under Contract');

console.log(`\n── Summary ──`);
console.log(`Total rows:           ${allRows.length}`);
console.log(`Matched to building:  ${matched.length}`);
console.log(`Enriched (floor plan): ${enriched.length}`);
console.log(`Closed/Sold:          ${closed.length}`);
console.log(`Active:               ${active.length}`);
console.log(`Historical (pre-MLS): ${transactionRows.length}`);
console.log(`MLS CSV imports:      ${mlsRows.length}`);

// Buildings breakdown
const byBuilding = {};
for (const row of allRows) {
  if (row.buildingSlug) {
    byBuilding[row.buildingSlug] = (byBuilding[row.buildingSlug] || 0) + 1;
  }
}
console.log(`\n── Buildings with data (${Object.keys(byBuilding).length}) ──`);
for (const [slug, count] of Object.entries(byBuilding).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${slug}: ${count} rows`);
}
