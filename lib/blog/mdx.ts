// MDX Blog & Insights Utilities
// Reads and parses MDX files from content/blog/ and content/insights/ directories
// Also reads newsletter HTML from content/insights/newsletters/

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { NewsletterMeta } from "@/lib/newsletter/types";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const INSIGHTS_DIR = path.join(process.cwd(), "content", "insights");
const NEWSLETTERS_DIR = path.join(INSIGHTS_DIR, "newsletters");

export interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  keywords: string[];
  image?: string;
  thumbnail?: string;
  category?: "newsletter" | "article" | "market-report";
  status: "draft" | "published";
  readingTime: number; // minutes
  format?: "mdx" | "html";
}

export interface BlogPost extends BlogPostMeta {
  content: string; // Raw MDX content or cleaned HTML
  format?: "mdx" | "html";
}

// ─── Generic helpers (read from any directory) ───────────────────────────────

function getAllPostsFromDir(dir: string): BlogPostMeta[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

  const posts = files
    .map((filename) => {
      const slug = filename.replace(/\.mdx$/, "");
      const filePath = path.join(dir, filename);
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const { data, content } = matter(fileContent);

      return {
        slug,
        title: data.title || slug,
        description: data.description || "",
        date: data.date || "",
        author: data.author || "Jacob Hannusch",
        tags: data.tags || [],
        keywords: data.keywords || [],
        image: data.image || undefined,
        thumbnail: data.thumbnail || undefined,
        category: data.category || undefined,
        status: data.status || "draft",
        readingTime: estimateReadingTime(content),
        format: "mdx" as const,
      } as BlogPostMeta;
    })
    .filter((post) => post.status === "published")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

function getPostBySlugFromDir(dir: string, slug: string): BlogPost | null {
  const filePath = path.join(dir, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  return {
    slug,
    title: data.title || slug,
    description: data.description || "",
    date: data.date || "",
    author: data.author || "Jacob Hannusch",
    tags: data.tags || [],
    keywords: data.keywords || [],
    image: data.image || undefined,
    thumbnail: data.thumbnail || undefined,
    category: data.category || undefined,
    status: data.status || "draft",
    readingTime: estimateReadingTime(content),
    content,
    format: "mdx",
  };
}

function getAllSlugsFromDir(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}

// ─── Newsletter helpers (content/insights/newsletters/) ──────────────────────

function getAllNewsletterMetas(): BlogPostMeta[] {
  if (!fs.existsSync(NEWSLETTERS_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(NEWSLETTERS_DIR, { withFileTypes: true });
  const metas: BlogPostMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const metaPath = path.join(NEWSLETTERS_DIR, entry.name, "meta.json");
    if (!fs.existsSync(metaPath)) continue;

    try {
      const raw: NewsletterMeta = JSON.parse(
        fs.readFileSync(metaPath, "utf-8")
      );

      metas.push({
        slug: raw.slug,
        title: raw.title,
        description: raw.description,
        date: raw.date,
        author: raw.author,
        tags: raw.tags,
        keywords: raw.keywords,
        thumbnail: raw.thumbnail || undefined,
        category: raw.category,
        status: raw.status,
        readingTime: raw.readingTime,
        format: "html",
      });
    } catch {
      // Skip malformed meta.json files
    }
  }

  return metas;
}

function getNewsletterBySlug(slug: string): BlogPost | null {
  const metaPath = path.join(NEWSLETTERS_DIR, slug, "meta.json");
  const htmlPath = path.join(NEWSLETTERS_DIR, slug, "content.html");

  if (!fs.existsSync(metaPath) || !fs.existsSync(htmlPath)) {
    return null;
  }

  try {
    const raw: NewsletterMeta = JSON.parse(
      fs.readFileSync(metaPath, "utf-8")
    );
    const html = fs.readFileSync(htmlPath, "utf-8");

    return {
      slug: raw.slug,
      title: raw.title,
      description: raw.description,
      date: raw.date,
      author: raw.author,
      tags: raw.tags,
      keywords: raw.keywords,
      thumbnail: raw.thumbnail || undefined,
      category: raw.category,
      status: raw.status,
      readingTime: raw.readingTime,
      content: html,
      format: "html",
    };
  } catch {
    return null;
  }
}

function getAllNewsletterSlugs(): string[] {
  if (!fs.existsSync(NEWSLETTERS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(NEWSLETTERS_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      return fs.existsSync(
        path.join(NEWSLETTERS_DIR, entry.name, "meta.json")
      );
    })
    .map((entry) => entry.name);
}

// ─── Blog (content/blog/) ────────────────────────────────────────────────────

/**
 * Get all published blog post metadata (sorted by date, newest first).
 */
export function getAllPosts(): BlogPostMeta[] {
  return getAllPostsFromDir(BLOG_DIR);
}

/**
 * Get a single blog post by slug (including content).
 */
export function getPostBySlug(slug: string): BlogPost | null {
  return getPostBySlugFromDir(BLOG_DIR, slug);
}

/**
 * Get all unique tags across published posts.
 */
export function getAllTags(): string[] {
  const posts = getAllPosts();
  const tagSet = new Set<string>();
  posts.forEach((post) => post.tags.forEach((tag) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

/**
 * Get posts by tag.
 */
export function getPostsByTag(tag: string): BlogPostMeta[] {
  return getAllPosts().filter((post) =>
    post.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
  );
}

/**
 * Get all slugs for static generation.
 */
export function getAllPostSlugs(): string[] {
  return getAllSlugsFromDir(BLOG_DIR);
}

// ─── Insights (content/insights/) ────────────────────────────────────────────

/**
 * Get all published insights (MDX + newsletters, sorted by date, newest first).
 */
export function getAllInsights(): BlogPostMeta[] {
  const mdxPosts = getAllPostsFromDir(INSIGHTS_DIR);
  const newsletters = getAllNewsletterMetas();

  // Newsletters take priority over MDX files with the same slug
  const newsletterSlugs = new Set(newsletters.map((n) => n.slug));
  const uniqueMdx = mdxPosts.filter((p) => !newsletterSlugs.has(p.slug));

  return [...uniqueMdx, ...newsletters].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Get a single insight by slug (including content).
 * Checks newsletters first, then falls back to MDX.
 */
export function getInsightBySlug(slug: string): BlogPost | null {
  // Newsletter HTML takes priority over MDX
  const newsletter = getNewsletterBySlug(slug);
  if (newsletter) return newsletter;

  return getPostBySlugFromDir(INSIGHTS_DIR, slug);
}

/**
 * Get insights filtered by category.
 */
export function getInsightsByCategory(
  category: "newsletter" | "article"
): BlogPostMeta[] {
  return getAllInsights().filter((post) => post.category === category);
}

/**
 * Get all insight slugs for static generation.
 */
export function getAllInsightSlugs(): string[] {
  const mdxSlugs = getAllSlugsFromDir(INSIGHTS_DIR);
  const newsletterSlugs = getAllNewsletterSlugs();

  // Deduplicate (newsletter slugs take priority)
  const allSlugs = new Set([...newsletterSlugs, ...mdxSlugs]);
  return Array.from(allSlugs);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Estimate reading time in minutes.
 */
function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
