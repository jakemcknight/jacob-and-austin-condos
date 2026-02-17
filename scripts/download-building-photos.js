#!/usr/bin/env node
/**
 * Download and process building exterior photos.
 * Usage: node scripts/download-building-photos.js
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const OUTPUT_DIR = path.join(__dirname, "..", "public", "images", "buildings");
const WIDTH = 1200;
const HEIGHT = 900;

// Strip WordPress thumbnail dimensions from URL to get full-size
function getFullSizeUrl(url) {
  return url.replace(/-\d+x\d+(\.\w+)$/, "$1");
}

// Map of building slug -> best exterior image URL (full-size)
const BUILDING_IMAGES = {
  "the-modern-austin": "https://modernaustinresidences.com/wp-content/uploads/2025/06/TheModernAustin-Lobby-Ext-Lobby-Bar-cropped-e1750874669679.jpg",
  "44-east-avenue": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/44-east-avenue.jpg"),
  "the-independent": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/independent_main.jpg"),
  "seaholm-residences": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/Seaholm_Entry_2016.jpg"),
  "70-rainey": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/70_Rainey_from_the_East.jpg"),
  "austin-proper-residences": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/Austin-Proper-Rendering-2.jpg"),
  "5th-and-west": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/fifth-west-01-ExteriorLookingWest.jpg"),
  "four-seasons-residences": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/the-four-seasons-residences-downtown-austin-condos-for-sale.jpg"),
  "the-w-residences": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/210-Lavaca-St-2803-MLS_Size-027-63-Standing-Tall-1024x768-72dpi-e1512513433358.jpg"),
  "the-austonian": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/austonian-feature.jpg"),
  "360-condominiums": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/360-condos-360-nueces-st-austin-texas-78701-03.jpg"),
  "the-shore-condominiums": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/603-Davis-Street-1401-MLS_Size-025-Rear-Exterior-121-1024x768-72dpi.jpg"),
  "austin-city-lofts": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/austin_city_lofts.jpg"),
  "spring-condominiums": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/300-Bowie-St-3606-large-014-Point-Tower-Construction-667x1000-72dpi.jpg"),
  "milago": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/011-439873-54Rainey_Milago_4_12383779-780x438.jpg"),
  "the-towers-of-town-lake": "https://www.urbanspacerealtors.com/nitropack_static/TUiPSHFULEfACBAWHFtmqowuQpcBQCrf/assets/images/optimized/rev-b3cb299/www.urbanspacerealtors.com/wp-content/uploads/2023/02/7152126e1e55362fc3833889966e4f75.Hero-Image-Towers-of-Town-Lake-scaled.jpg",
  "cambridge-tower": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/cambridge-tower.jpg"),
  "sabine-on-5th": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/REATX-Realty-Austin-Condos-507-Sabine-St-Unit-306-78701-201.jpg"),
  "904-west": "https://www.urbanspacerealtors.com/nitropack_static/TUiPSHFULEfACBAWHFtmqowuQpcBQCrf/assets/images/optimized/rev-b3cb299/www.urbanspacerealtors.com/wp-content/uploads/2023/02/bc340d8968e7a0d8ba0fffe7d31569a3.Hero-Image-904-West-scaled.jpg",
  "celias-court": "https://www.urbanspacerealtors.com/wp-content/uploads/2023/02/Hero-Image-Celias-Court-scaled.jpg",
  "brazos-place": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/800Brazos810-Exterior2.jpg"),
  "5-fifty-five": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/018-271081-555-E_6388231.jpg"),
  "nokonah": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/the-nokonah-exterior-2-1.jpg"),
  "vesper": "https://towers.wpenginepowered.com/wp-content/uploads/sites/19/PEAVE_01_Hero_Exterior_H2-scaled.jpg",
  "plaza-lofts": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/9-Plaza-Lofts.jpg"),
  // "1704-west-condos": skipped — no publicly accessible exterior photo found
  "the-linden": "https://towers.wpenginepowered.com/wp-content/uploads/sites/19/LIND_View07_Street_06-New-scaled.jpg",
  "natiivo": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/natiivo_rendering_3-e1570145474939.jpg"),
  "1306-west": "https://www.austincondomaps.com/wp-content/uploads/2017/07/1306-west.png",
  "westgate-tower": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/1122-Colorado-Street-Westgate-Tower_RuudPhoto_4-2-17_84.jpg"),
  "penthouse-condos": "https://www.austincondomaps.com/wp-content/uploads/2013/08/penthouse.jpg",
  "brown-building": getFullSizeUrl("https://towers.wpenginepowered.com/wp-content/uploads/sites/19/brown-building.jpg"),
  "terrace-on-shoal-creek": "https://www.austincondomaps.com/wp-content/uploads/2013/11/terrace-on-shoal-creek.jpg",
  "greenwood-tower": "https://s3.amazonaws.com/propertybase-clients/00Dd0000000i48XEAQ/a0Cd000000lwyvt/p1d52pkspkf26u3f1uka1fr7l3f9/greenwood%20tower%20exterior.jpg",
};

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("https") ? https.get : http.get;

    const request = get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/*,*/*",
        "Referer": "https://www.google.com/"
      }
    }, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let redirectUrl = response.headers.location;
        if (redirectUrl.startsWith("/")) {
          const urlObj = new URL(url);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        downloadImage(redirectUrl).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error(`Timeout downloading ${url}`));
    });
  });
}

async function processImage(inputBuffer, outputPath) {
  await sharp(inputBuffer)
    .resize(WIDTH, HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 80 })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  return stats.size;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const slugs = Object.keys(BUILDING_IMAGES);
  console.log(`Processing ${slugs.length} buildings...\n`);

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const slug of slugs) {
    const url = BUILDING_IMAGES[slug];
    const outputPath = path.join(OUTPUT_DIR, `${slug}.jpg`);

    try {
      process.stdout.write(`  ${slug}... `);
      const buffer = await downloadImage(url);
      const size = await processImage(buffer, outputPath);
      console.log(`OK (${(size / 1024).toFixed(0)}KB)`);
      success++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failures.push({ slug, url, error: err.message });
      failed++;
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Done: ${success} succeeded, ${failed} failed out of ${slugs.length}`);

  if (failures.length > 0) {
    console.log(`\nFailed buildings:`);
    for (const f of failures) {
      console.log(`  - ${f.slug}: ${f.error}`);
      console.log(`    URL: ${f.url}`);
    }
  }
}

main().catch(console.error);
