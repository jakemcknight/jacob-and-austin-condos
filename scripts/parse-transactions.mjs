/**
 * Parses the transactions CSV and generates data/transactions.ts
 * Run with: node scripts/parse-transactions.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CSV_FILE = join(import.meta.dirname, "..", "data", "Downtown Condo Database - Transactions.csv");
const OUTPUT_FILE = join(import.meta.dirname, "..", "data", "transactions.ts");

// Map CSV building names to our slug system
const BUILDING_MAP = {
  "360 Condos": "360-condominiums",
  "44 East": "44-east-avenue",
  "5th & West": "5th-and-west",
  "70 Rainey": "70-rainey",
  "904 West Condos": "904-west",
  "908 Nueces": "celias-court",
  "Austin City Lofts": "austin-city-lofts",
  "Austin Proper": "austin-proper-residences",
  "Brazos Lofts": "brazos-lofts",
  "Brazos Place": "brazos-place",
  "Cambridge Condos": "cambridge-tower",
  "Celias Court": "celias-court",
  "Five Fifty 05": "5-fifty-five",
  "Four Seasons": "four-seasons-residences",
  "Milago": "milago",
  "Nokonah": "nokonah",
  "Sabine on 5th": "sabine-on-5th",
  "Seaholm Residences": "seaholm-residences",
  "Spring Condos": "spring-condominiums",
  "The Austonian": "the-austonian",
  "The Independent": "the-independent",
  "The Shore": "the-shore-condominiums",
  "Towers of Town Lake": "the-towers-of-town-lake",
  "W Residences": "the-w-residences",
};

// Parse a CSV line handling quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Parse dollar amount like "$180,600" to number
function parseDollar(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Parse number with commas like "1,459" to number
function parseNum(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function main() {
  const content = readFileSync(CSV_FILE, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  // Skip header
  const header = parseCSVLine(lines[0]);
  console.log("Header:", header.slice(0, 10));

  const byBuilding = {};
  let matched = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    // Columns: Address, Unit Number, Building, Bedrooms, Baths, Close Date, Closed Price, Sqft, Closed Price/Sqft, ...
    const buildingName = fields[2];
    const slug = BUILDING_MAP[buildingName];

    if (!slug) {
      skipped++;
      continue;
    }

    const date = fields[5]; // YYYY-MM-DD
    const price = parseDollar(fields[6]);
    const sqft = parseNum(fields[7]);
    const pricePerSqft = parseDollar(fields[8]);
    const bedrooms = parseInt(fields[3]) || 0;
    const unit = fields[1] || "";

    // Skip invalid entries
    if (!date || price <= 0) continue;
    // Skip obviously bad sqft data (like 43,752 which is clearly wrong)
    if (sqft > 10000) continue;

    if (!byBuilding[slug]) byBuilding[slug] = [];
    byBuilding[slug].push({ date, price, pricePerSqft, sqft, bedrooms, unit });

    matched++;
  }

  // Sort each building's transactions by date
  for (const slug of Object.keys(byBuilding)) {
    byBuilding[slug].sort((a, b) => a.date.localeCompare(b.date));
  }

  console.log(`\nMatched: ${matched} transactions`);
  console.log(`Skipped: ${skipped} (buildings not in our list)`);
  console.log(`Buildings with data: ${Object.keys(byBuilding).length}`);
  for (const [slug, txns] of Object.entries(byBuilding)) {
    console.log(`  ${slug}: ${txns.length} transactions`);
  }

  // Generate TypeScript file
  let ts = `export interface Transaction {
  date: string;
  price: number;
  pricePerSqft: number;
  sqft: number;
  bedrooms: number;
  unit: string;
}

export const transactionsByBuilding: Record<string, Transaction[]> = {\n`;

  for (const [slug, txns] of Object.entries(byBuilding).sort(([a], [b]) => a.localeCompare(b))) {
    ts += `  "${slug}": [\n`;
    for (const t of txns) {
      ts += `    { date: "${t.date}", price: ${t.price}, pricePerSqft: ${t.pricePerSqft}, sqft: ${t.sqft}, bedrooms: ${t.bedrooms}, unit: "${t.unit.replace(/"/g, '\\"')}" },\n`;
    }
    ts += `  ],\n`;
  }

  ts += `};\n`;

  writeFileSync(OUTPUT_FILE, ts);
  console.log(`\nWritten to ${OUTPUT_FILE}`);
}

main();
