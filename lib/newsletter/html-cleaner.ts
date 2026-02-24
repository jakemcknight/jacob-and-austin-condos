import * as cheerio from "cheerio";
import type { CleanedHtml } from "./types";

export function cleanMailchimpHtml(
  rawHtml: string,
  slug: string
): CleanedHtml {
  const $ = cheerio.load(rawHtml);
  const images: CleanedHtml["images"] = [];
  let imgIndex = 0;

  // 1. Remove <style> blocks — inline styles handle everything in email HTML
  $("style").remove();

  // 2. Remove <script> tags (safety)
  $("script").remove();

  // 3. Remove tracking pixels (1x1 images, list-manage tracking)
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    const width = $(el).attr("width");
    const height = $(el).attr("height");

    // Remove 1x1 tracking pixels
    if (width === "1" && height === "1") {
      $(el).remove();
      return;
    }

    // Remove Mailchimp tracking images
    if (
      src.includes("list-manage.com/track") ||
      src.includes("mailchimp.com/track")
    ) {
      $(el).remove();
      return;
    }
  });

  // 4. Remove preheader (hidden text with invisible spacing characters)
  // Mailchimp inserts a preheader div/span with display:none or very small text
  $("[style*='display:none'], [style*='display: none']").each((_, el) => {
    const text = $(el).text().trim();
    // Preheader text is mostly invisible characters
    if (text.length === 0 || /^[\s\u200c\u034f\u00ad\u200b\u2060]+$/.test(text)) {
      $(el).remove();
    }
  });

  // Also remove the zero-width preheader block (common Mailchimp pattern)
  $("div[style*='max-height:0'], span[style*='max-height:0']").remove();

  // 5. Remove Mailchimp footer — look for unsubscribe section
  // Find elements containing "unsubscribe" text and remove from there down
  const footerSelectors = [
    "#templateFooter",
    ".mcnFollowContent",
    "[data-block-id] a[href*='unsubscribe']",
  ];

  for (const sel of footerSelectors) {
    const footerEl = $(sel);
    if (footerEl.length) {
      // Walk up to find the containing table row or section
      const footerSection =
        footerEl.closest("table[role='presentation']") ||
        footerEl.closest("tr") ||
        footerEl;
      footerSection.remove();
    }
  }

  // Remove Mailchimp monkey/badge
  $("img[src*='cdn-images.mailchimp.com']").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src.includes("Freddie") || src.includes("MonkeyReward") || src.includes("badge")) {
      const container =
        $(el).closest("table") || $(el).closest("div") || $(el);
      container.remove();
    }
  });

  // Also remove any elements with "unsubscribe" or "update your preferences" text
  $("a").each((_, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes("unsubscribe") || text.includes("update your preferences")) {
      // Remove the parent row/cell containing this link
      const parentCell = $(el).closest("td");
      if (parentCell.length) {
        const parentRow = parentCell.closest("tr");
        if (parentRow.length) {
          parentRow.remove();
        }
      }
    }
  });

  // 6. Strip inline font-family so our brand font cascades from CSS
  $("[style]").each((_, el) => {
    const style = $(el).attr("style") || "";
    if (style.includes("font-family")) {
      const cleaned = style.replace(/font-family:[^;]+;?/gi, "").trim();
      if (cleaned) {
        $(el).attr("style", cleaned);
      } else {
        $(el).removeAttr("style");
      }
    }
  });

  // 7. Collect content images and rewrite URLs
  $("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (!src) return;

    // Skip data URIs and already-local paths
    if (src.startsWith("data:") || src.startsWith("/")) return;

    // Skip Mailchimp CDN branding images
    if (src.includes("cdn-images.mailchimp.com")) {
      $(el).remove();
      return;
    }

    const ext = getImageExtension(src);
    const localPath = `/images/newsletters/${slug}/img-${String(imgIndex).padStart(3, "0")}.${ext}`;
    imgIndex++;

    images.push({ remoteUrl: src, localPath });
    $(el).attr("src", localPath);

    // Make images responsive
    $(el).css("max-width", "100%");
    $(el).css("height", "auto");

    // Remove hard-coded widths over 600px
    const width = parseInt($(el).attr("width") || "0");
    if (width > 600) {
      $(el).removeAttr("width");
    }
  });

  // 7. Extract "In This Issue" subtitle text
  let inThisIssue = "";
  $(".mceText").each((_, el) => {
    const text = $(el).text();
    if (text.includes("IN THIS ISSUE")) {
      // The subtitle follows "IN THIS ISSUE" — grab everything after it
      const match = text.replace(/\s+/g, " ").match(/IN THIS ISSUE\s*(.+)/i);
      if (match) {
        inThisIssue = match[1].trim();
      }
    }
  });

  // 8. Add contextual alt text to images based on their section
  // Format the slug into a readable date for alt text
  const dateLabel = slug.replace(/-/g, "/");

  // Track which section each image belongs to using document-order scanning
  let currentSection = "banner"; // first images before any h3 are the banner
  let sharingAMomentImage = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharingAMomentEl: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendingOffMarketImg: any = null;

  $("h3, img, td[id^='b']").each((_, el) => {
    const tag = (el as { tagName: string }).tagName;

    if (tag === "h3") {
      const heading = $(el).text().trim().toUpperCase();
      if (heading.includes("SHARING A MOMENT")) {
        currentSection = "sharing";
      } else if (heading.includes("OFF MARKET")) {
        currentSection = "offmarket";
      } else if (heading.includes("DATA DIVE")) {
        currentSection = "data";
      } else if (heading.includes("STAY IN THE LOOP")) {
        currentSection = "loop";
      }
    } else if (tag === "td" && currentSection === "offmarket" && pendingOffMarketImg) {
      // Caption td follows the image td — extract building name
      const firstP = $(el).find("p").first().text().trim();
      if (firstP && firstP.length < 80) {
        // Strip unit number (e.g., "The Independent #2806" → "The Independent")
        const buildingName = firstP.replace(/\s*#\d+.*$/, "").trim();
        pendingOffMarketImg.attr(
          "alt",
          `${buildingName} - Downtown Austin Off-Market Condo Listing`
        );
      }
      pendingOffMarketImg = null;
    } else if (tag === "img") {
      const src = $(el).attr("src") || "";
      if (!src || src.startsWith("data:")) return;

      if (currentSection === "banner" && !$(el).attr("alt")) {
        $(el).attr("alt", `Downtown Austin Newsletter Banner - ${dateLabel}`);
      } else if (currentSection === "sharing" && !sharingAMomentImage) {
        sharingAMomentImage = src;
        sharingAMomentEl = $(el);
        // Alt text will be set after we find the caption below
      } else if (currentSection === "offmarket" && !$(el).attr("alt")) {
        // Only treat as listing image if parent td has minimal text (standalone image)
        const imgTd = $(el).closest("td[id^='b']");
        const tdText = imgTd.length ? imgTd.text().trim() : "";
        if (tdText.length < 20) {
          pendingOffMarketImg = $(el);
        }
      }
    }
  });

  // Find the caption for the Sharing a Moment image (text block after the image)
  const samEl = sharingAMomentEl;
  if (samEl) {
    let samCaption = "";
    // Scan block-level tds after the image for caption text
    const samImgBlock = samEl.closest("td[id^='b']");
    if (samImgBlock.length) {
      const samBlockId = samImgBlock.attr("id") || "";
      let foundImageBlock = false;
      $("td[id^='b']").each((_, td) => {
        if (samCaption) return;
        const tdId = $(td).attr("id") || "";
        if (tdId === samBlockId) {
          foundImageBlock = true;
          return;
        }
        if (foundImageBlock) {
          const text = $(td).text().trim();
          if (text.length > 5) {
            samCaption = text;
          }
        }
      });
    }
    const altText = samCaption
      ? `Downtown Austin - ${samCaption}`
      : `Downtown Austin - Sharing a Moment ${dateLabel}`;
    samEl.attr("alt", altText);
  }

  // 9. Extract body content — get everything inside <body> or the whole doc
  let html: string;
  const body = $("body");
  if (body.length) {
    html = body.html() || "";
  } else {
    html = $.html();
  }

  // Remove <html>, <head>, <body>, <!DOCTYPE> wrapper tags if present
  html = html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "")
    .trim();

  // 10. Extract plain text for reading time and description
  const textContent = $("body").text().replace(/\s+/g, " ").trim();

  return { html, images, textContent, inThisIssue, sharingAMomentImage };
}

function getImageExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(\w+)$/);
    if (match) {
      const ext = match[1].toLowerCase();
      if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
        return ext;
      }
    }
  } catch {
    // URL parsing failed
  }
  return "jpg"; // Default
}
