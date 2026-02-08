/**
 * Updates floorPlans.ts to replace Google Drive URLs with local paths.
 * Run with: node scripts/update-floor-plan-paths.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DATA_FILE = join(import.meta.dirname, "..", "data", "floorPlans.ts");
const MAPPING_FILE = join(import.meta.dirname, "floor-plan-paths.json");

const mapping = JSON.parse(readFileSync(MAPPING_FILE, "utf-8"));
let content = readFileSync(DATA_FILE, "utf-8");

let replacements = 0;

// Replace all Google Drive imageUrl values with local paths
for (const [fileId, localPath] of Object.entries(mapping)) {
  const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  if (content.includes(driveUrl)) {
    content = content.replaceAll(driveUrl, localPath);
    replacements++;
  }
}

// Also remove pdfUrl since we no longer need Google Drive links
// Replace pdfUrl with empty string (we'll handle this in the component)
content = content.replace(/pdfUrl: "https:\/\/drive\.google\.com\/[^"]+"/g, 'pdfUrl: ""');

writeFileSync(DATA_FILE, content);
console.log(`Updated ${replacements} imageUrl references to local paths.`);
console.log("Cleared all pdfUrl Google Drive links.");
