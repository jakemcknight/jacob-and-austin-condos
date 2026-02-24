/**
 * Newsletter Sync Script
 *
 * Pulls sent campaigns from Mailchimp, cleans the HTML, downloads images,
 * and saves everything to content/insights/newsletters/ for the website.
 *
 * Usage:
 *   npm run sync:newsletters
 *   npm run sync:newsletters -- --dry-run
 *   npm run sync:newsletters -- --force
 *   npm run sync:newsletters -- --campaign-id=abc123
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import matter from "gray-matter";
import {
  fetchSentCampaigns,
  fetchCampaignContent,
} from "../lib/newsletter/mailchimp-client";
import { cleanMailchimpHtml } from "../lib/newsletter/html-cleaner";
import type { NewsletterMeta, NewsletterManifest } from "../lib/newsletter/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const INSIGHTS_DIR = path.join(ROOT, "content", "insights");
const NEWSLETTERS_DIR = path.join(INSIGHTS_DIR, "newsletters");
const IMAGES_DIR = path.join(ROOT, "public", "images", "newsletters");
const MANIFEST_PATH = path.join(NEWSLETTERS_DIR, "manifest.json");

// ─── CLI Arg Parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const CAMPAIGN_ID_ARG = args.find((a) => a.startsWith("--campaign-id="));
const SINGLE_CAMPAIGN_ID = CAMPAIGN_ID_ARG?.split("=")[1];

// ─── Env ─────────────────────────────────────────────────────────────────────

// Load .env.local for local development
function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSlug(sendTime: string): string {
  const d = new Date(sendTime);
  return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
}

function formatDate(sendTime: string): string {
  const d = new Date(sendTime);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function generateDescription(text: string): string {
  // Take first ~160 chars of meaningful text
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 160) return cleaned;
  return cleaned.slice(0, 157) + "...";
}

/**
 * Read existing MDX frontmatter to inherit curated titles and descriptions.
 */
function getExistingMdxMeta(slug: string): { title?: string; description?: string; tags?: string[]; keywords?: string[] } | null {
  const mdxPath = path.join(INSIGHTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(mdxPath)) return null;

  try {
    const content = fs.readFileSync(mdxPath, "utf-8");
    const { data } = matter(content);
    return {
      title: data.title || undefined,
      description: data.description || undefined,
      tags: data.tags || undefined,
      keywords: data.keywords || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Pick the first substantial image as thumbnail (skip tiny logos/icons).
 */
function findBestThumbnail(images: Array<{ remoteUrl: string; localPath: string }>): string {
  const MIN_SIZE = 10000; // 10KB minimum for a real content image
  for (const img of images) {
    const fullPath = path.join(ROOT, "public", img.localPath);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size >= MIN_SIZE) {
        return img.localPath;
      }
    } catch {
      // File doesn't exist yet or error — skip
    }
  }
  // Fallback to first image if all are small
  return images.length > 0 ? images[0].localPath : "";
}

function loadManifest(): NewsletterManifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  }
  return { lastSyncedAt: "", campaigns: {} };
}

function saveManifest(manifest: NewsletterManifest): void {
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function downloadImage(
  url: string,
  localPath: string
): Promise<boolean> {
  const fullPath = path.join(ROOT, "public", localPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ⚠ Image download failed (${res.status}): ${url}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        return false;
      }

      const buffer = Buffer.from(await res.arrayBuffer());

      // Optimize with sharp: resize to max 1200px width, 80% quality
      try {
        const metadata = await sharp(buffer).metadata();
        let pipeline = sharp(buffer);

        if (metadata.width && metadata.width > 1200) {
          pipeline = pipeline.resize(1200);
        }

        if (metadata.format === "jpeg" || metadata.format === "jpg") {
          pipeline = pipeline.jpeg({ quality: 80 });
        } else if (metadata.format === "png") {
          pipeline = pipeline.png({ quality: 80 });
        }

        await pipeline.toFile(fullPath);
      } catch {
        // If sharp fails (e.g., unsupported format), save raw
        fs.writeFileSync(fullPath, buffer);
      }

      return true;
    } catch (err) {
      console.warn(`  ⚠ Image download error (attempt ${attempt}): ${url}`);
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;

  if (!apiKey || !listId) {
    console.error(
      "❌ MAILCHIMP_API_KEY and MAILCHIMP_LIST_ID must be set in .env.local or environment"
    );
    process.exit(1);
  }

  console.log("📬 Newsletter Sync");
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN" : FORCE ? "FORCE" : "normal"}`);
  if (SINGLE_CAMPAIGN_ID) {
    console.log(`   Campaign: ${SINGLE_CAMPAIGN_ID}`);
  }
  console.log();

  // 1. Load manifest
  const manifest = loadManifest();

  // 2. Fetch campaigns from Mailchimp
  console.log("Fetching campaigns from Mailchimp...");
  const campaigns = await fetchSentCampaigns(apiKey, listId);
  console.log(`Found ${campaigns.length} sent campaigns\n`);

  // 3. Filter to campaigns that need syncing
  const toSync = campaigns.filter((c) => {
    if (SINGLE_CAMPAIGN_ID) return c.id === SINGLE_CAMPAIGN_ID;
    if (FORCE) return true;
    return !manifest.campaigns[c.id];
  });

  if (toSync.length === 0) {
    console.log("✅ Everything is up to date. Nothing to sync.");
    return;
  }

  console.log(`Syncing ${toSync.length} campaigns...\n`);

  let synced = 0;
  let failed = 0;
  const usedSlugs = new Set<string>();

  for (const campaign of toSync) {
    let slug = formatSlug(campaign.send_time);
    // Handle duplicate slugs (multiple campaigns on same date)
    if (usedSlugs.has(slug)) {
      slug = `${slug}-2`;
      // If that's also taken, keep incrementing
      let counter = 2;
      while (usedSlugs.has(slug)) {
        counter++;
        slug = `${formatSlug(campaign.send_time)}-${counter}`;
      }
    }
    usedSlugs.add(slug);
    const title = campaign.settings.subject_line;
    console.log(`── ${slug}: "${title}"`);

    if (DRY_RUN) {
      console.log("   (dry run — skipping)\n");
      synced++;
      continue;
    }

    try {
      // Fetch HTML content
      console.log("   Fetching HTML...");
      const rawHtml = await fetchCampaignContent(apiKey, campaign.id);

      if (!rawHtml || rawHtml.trim().length === 0) {
        console.warn("   ⚠ Empty HTML — skipping\n");
        failed++;
        continue;
      }

      // Clean HTML and extract images
      console.log("   Cleaning HTML...");
      const cleaned = cleanMailchimpHtml(rawHtml, slug);

      // Download images
      if (cleaned.images.length > 0) {
        console.log(`   Downloading ${cleaned.images.length} images...`);
        for (const img of cleaned.images) {
          const ok = await downloadImage(img.remoteUrl, img.localPath);
          if (ok) {
            process.stdout.write("   .");
          } else {
            process.stdout.write("   x");
          }
        }
        console.log();
      }

      // Inherit curated metadata from existing MDX files when available
      const mdxMeta = getExistingMdxMeta(slug);

      // Determine best title: MDX curated > "In This Issue" text > Mailchimp preview > subject line
      const bestTitle = mdxMeta?.title
        || cleaned.inThisIssue
        || campaign.settings.preview_text
        || title;

      // Determine best thumbnail: "Sharing a Moment" image > first large content image
      const bestThumbnail = cleaned.sharingAMomentImage || findBestThumbnail(cleaned.images);

      // Generate metadata
      const meta: NewsletterMeta = {
        slug,
        campaignId: campaign.id,
        title: bestTitle,
        description: mdxMeta?.description || generateDescription(cleaned.textContent),
        date: formatDate(campaign.send_time),
        author: "Jacob Hannusch",
        tags: mdxMeta?.tags || ["downtown austin", "newsletter"],
        keywords: mdxMeta?.keywords || ["downtown austin", "condos", "real estate", "newsletter"],
        thumbnail: bestThumbnail,
        category: "newsletter",
        status: "published",
        readingTime: estimateReadingTime(cleaned.textContent),
      };

      // Write files
      const newsletterDir = path.join(NEWSLETTERS_DIR, slug);
      fs.mkdirSync(newsletterDir, { recursive: true });

      fs.writeFileSync(
        path.join(newsletterDir, "meta.json"),
        JSON.stringify(meta, null, 2)
      );
      fs.writeFileSync(
        path.join(newsletterDir, "content.html"),
        cleaned.html
      );

      // Update manifest
      manifest.campaigns[campaign.id] = {
        slug,
        syncedAt: new Date().toISOString(),
        sendTime: campaign.send_time,
      };

      console.log(`   ✅ Saved\n`);
      synced++;

      // Small delay between campaigns to be polite to Mailchimp API
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`   ❌ Failed: ${err}\n`);
      failed++;
    }
  }

  // Save manifest
  if (!DRY_RUN) {
    manifest.lastSyncedAt = new Date().toISOString();
    saveManifest(manifest);
  }

  console.log("\n────────────────────────────────");
  console.log(`✅ Synced: ${synced}`);
  if (failed > 0) console.log(`❌ Failed: ${failed}`);
  console.log(
    `📂 Total newsletters: ${Object.keys(manifest.campaigns).length}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
