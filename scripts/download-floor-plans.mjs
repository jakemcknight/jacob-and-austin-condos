/**
 * Downloads all floor plan images from Google Drive and saves them locally.
 * Run with: node scripts/download-floor-plans.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import https from "https";

const DATA_FILE = join(import.meta.dirname, "..", "data", "floorPlans.ts");
const OUTPUT_DIR = join(import.meta.dirname, "..", "public", "floor-plans");

// Parse the floorPlans.ts to extract building slugs, plan names, and file IDs
function parseFloorPlans() {
  const content = readFileSync(DATA_FILE, "utf-8");
  const plans = [];

  // Match each building slug section
  const buildingRegex = /"([^"]+)":\s*\[/g;
  let buildingMatch;

  while ((buildingMatch = buildingRegex.exec(content)) !== null) {
    const slug = buildingMatch[1];
    // Find all plans within this building's array
    const startIdx = buildingMatch.index;
    let depth = 0;
    let arrayStart = -1;
    let arrayEnd = -1;

    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === "[" && arrayStart === -1) {
        arrayStart = i;
        depth = 1;
      } else if (content[i] === "[" && arrayStart !== -1) {
        depth++;
      } else if (content[i] === "]") {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }

    if (arrayStart === -1 || arrayEnd === -1) continue;
    const arrayContent = content.substring(arrayStart, arrayEnd + 1);

    // Extract each plan's name and imageUrl
    const planRegex = /name:\s*"([^"]+)".*?imageUrl:\s*"([^"]+)"/g;
    let planMatch;
    while ((planMatch = planRegex.exec(arrayContent)) !== null) {
      const name = planMatch[1];
      const imageUrl = planMatch[2];
      // Extract file ID from Google Drive URL
      const idMatch = imageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        plans.push({ slug, name, fileId: idMatch[1], imageUrl });
      }
    }
  }

  return plans;
}

// Download a file from Google Drive following redirects
function downloadFile(fileId) {
  return new Promise((resolve, reject) => {
    const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;

    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) {
        // Follow redirect
        https.get(res.headers.location, { headers: { "User-Agent": "Mozilla/5.0" } }, (res2) => {
          const chunks = [];
          res2.on("data", (c) => chunks.push(c));
          res2.on("end", () => resolve({ data: Buffer.concat(chunks), contentType: res2.headers["content-type"] }));
          res2.on("error", reject);
        }).on("error", reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for file ${fileId}`));
        return;
      }

      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ data: Buffer.concat(chunks), contentType: res.headers["content-type"] }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function getExtension(contentType) {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("pdf")) return "pdf";
  return "png"; // default
}

// Sanitize plan name for use as filename
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

async function main() {
  const plans = parseFloorPlans();
  console.log(`Found ${plans.length} floor plans to download.\n`);

  // Group by building for progress tracking
  const byBuilding = {};
  for (const p of plans) {
    if (!byBuilding[p.slug]) byBuilding[p.slug] = [];
    byBuilding[p.slug].push(p);
  }

  const results = []; // { slug, name, localPath }
  let downloaded = 0;
  let failed = 0;

  for (const [slug, buildingPlans] of Object.entries(byBuilding)) {
    const dir = join(OUTPUT_DIR, slug);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    console.log(`\n📁 ${slug} (${buildingPlans.length} plans)`);

    // Download 3 at a time to avoid rate limiting
    for (let i = 0; i < buildingPlans.length; i += 3) {
      const batch = buildingPlans.slice(i, i + 3);
      const batchResults = await Promise.allSettled(
        batch.map(async (plan) => {
          const filename = sanitizeName(plan.name);
          try {
            const { data, contentType } = await downloadFile(plan.fileId);
            const ext = getExtension(contentType);
            const filepath = join(dir, `${filename}.${ext}`);
            writeFileSync(filepath, data);
            const localPath = `/floor-plans/${slug}/${filename}.${ext}`;
            downloaded++;
            process.stdout.write(`  ✓ ${plan.name} (${(data.length / 1024).toFixed(0)}KB)\n`);
            return { slug: plan.slug, name: plan.name, localPath, fileId: plan.fileId };
          } catch (err) {
            failed++;
            process.stdout.write(`  ✗ ${plan.name}: ${err.message}\n`);
            return null;
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value) results.push(r.value);
      }

      // Small delay between batches to be polite to Google
      if (i + 3 < buildingPlans.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  console.log(`\n\nDone! Downloaded: ${downloaded}, Failed: ${failed}`);

  // Write a mapping file for updating floorPlans.ts
  const mappingFile = join(import.meta.dirname, "floor-plan-paths.json");
  const mapping = {};
  for (const r of results) {
    mapping[r.fileId] = r.localPath;
  }
  writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
  console.log(`\nMapping saved to ${mappingFile}`);
}

main().catch(console.error);
