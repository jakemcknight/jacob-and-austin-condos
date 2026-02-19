// AI Content Draft Generator
// Uses Claude API to generate SEO-optimized blog post drafts
// Enriched with real building data from the site

import Anthropic from "@anthropic-ai/sdk";
import { buildings } from "@/data/buildings";
import { kv } from "@vercel/kv";
import type { BlogDraft } from "./types";

/**
 * Generate a blog draft for a given topic/question.
 * The draft is formatted as MDX with frontmatter, ready for review.
 */
export async function generateDraft(
  topic: string,
  keywords: string[] = [],
  sourceGap?: string
): Promise<BlogDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY env var is not set.");
  }

  const client = new Anthropic({ apiKey });

  // Build context about the site's buildings for enrichment
  const buildingContext = buildings
    .slice(0, 20) // Top 20 buildings for context
    .map(
      (b) =>
        `- ${b.name}: ${b.address}, ${b.units} units, ${b.floors} floors, built ${b.yearBuilt}. Price range: ${b.priceRange}. Amenities: ${b.amenities.slice(0, 5).join(", ")}`
    )
    .join("\n");

  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are writing a blog post for Jacob Hannusch's website "Jacob In Austin" (jacobinaustin.com), a real estate website focused on downtown Austin high-rise condos.

TOPIC: ${topic}

TARGET KEYWORDS: ${keywords.length > 0 ? keywords.join(", ") : topic}

BUILDING DATA (use for internal linking and factual references):
${buildingContext}

REQUIREMENTS:
1. Write a comprehensive, helpful blog post (1000-1500 words)
2. Start with a clear, direct answer in the first paragraph (critical for AI citation/GEO)
3. Use H2 headers to organize sections
4. Include a FAQ section with 3-5 questions and concise answers
5. Include specific data points and statistics where relevant
6. Reference specific buildings from the data above with links like [Building Name](/building-slug)
7. Write in a professional but approachable tone — you are Jacob, a downtown Austin condo expert
8. End with a brief CTA to contact Jacob
9. DO NOT include the frontmatter — I will add that separately
10. Use markdown formatting (not HTML)
11. Make the content genuinely useful for someone researching downtown Austin condos

OUTPUT: Just the markdown content of the blog post (no frontmatter, no code fences around the whole thing).`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const content =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Build the full MDX with frontmatter
  const description = content
    .split("\n")
    .find((line) => line.length > 50 && !line.startsWith("#"))
    ?.slice(0, 155) || topic;

  const mdxContent = `---
title: "${topic.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: "${today}"
author: "Jacob Hannusch"
tags: ["downtown austin", "condos"]
keywords: ${JSON.stringify(keywords.length > 0 ? keywords : [topic.toLowerCase()])}
image: "/images/og-default.jpg"
status: "draft"
---

${content}`;

  const draft: BlogDraft = {
    slug,
    topic,
    keywords: keywords.length > 0 ? keywords : [topic.toLowerCase()],
    content: mdxContent,
    status: "draft_generated",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceGap,
  };

  // Store draft in KV
  await kv.set(`blog:drafts:${slug}`, draft, { ex: 30 * 86400 }); // 30 day expiry

  return draft;
}

/**
 * Get all stored drafts from KV.
 */
export async function getAllDrafts(): Promise<BlogDraft[]> {
  // Scan for all draft keys
  const keys: string[] = [];
  let scanCursor = "0";
  let done = false;

  while (!done) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await kv.scan(scanCursor, {
      match: "blog:drafts:*",
      count: 100,
    });
    scanCursor = String(result[0]);
    keys.push(...result[1]);
    if (scanCursor === "0") done = true;
  }

  if (keys.length === 0) return [];

  const drafts: BlogDraft[] = [];
  for (const key of keys) {
    const draft = await kv.get<BlogDraft>(key);
    if (draft) drafts.push(draft);
  }

  // Sort by creation date (newest first)
  return drafts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
