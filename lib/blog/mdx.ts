// MDX Blog & Insights Utilities
// Reads and parses MDX files from content/blog/ and content/insights/ directories

import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const INSIGHTS_DIR = path.join(process.cwd(), "content", "insights");

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
  category?: "newsletter" | "article";
  status: "draft" | "published";
  readingTime: number; // minutes
}

export interface BlogPost extends BlogPostMeta {
  content: string; // Raw MDX content (without frontmatter)
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
 * Get all published insights (sorted by date, newest first).
 */
export function getAllInsights(): BlogPostMeta[] {
  return getAllPostsFromDir(INSIGHTS_DIR);
}

/**
 * Get a single insight by slug (including content).
 */
export function getInsightBySlug(slug: string): BlogPost | null {
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
  return getAllSlugsFromDir(INSIGHTS_DIR);
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
