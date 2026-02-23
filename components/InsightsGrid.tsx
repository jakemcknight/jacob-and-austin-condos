"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { BlogPostMeta } from "@/lib/blog/mdx";

interface InsightsGridProps {
  posts: BlogPostMeta[];
}

type FilterType = "all" | "newsletter" | "article";

export default function InsightsGrid({ posts }: InsightsGridProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered =
    filter === "all"
      ? posts
      : posts.filter((p) => p.category === filter);

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "newsletter", label: "Past Newsletters" },
    { value: "article", label: "Articles" },
  ];

  return (
    <>
      {/* Filter Tabs */}
      <div className="mb-10 flex justify-center gap-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`border-b-2 pb-1 text-sm uppercase tracking-wider transition-colors ${
              filter === f.value
                ? "border-primary text-primary"
                : "border-transparent text-accent hover:text-primary"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-secondary">
          No posts found in this category.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <Link
              key={post.slug}
              href={`/insights/${post.slug}`}
              className="group block overflow-hidden border border-gray-100 bg-white transition-shadow hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div className="relative aspect-[16/10] overflow-hidden bg-gray-100">
                {post.thumbnail ? (
                  <Image
                    src={post.thumbnail}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-3xl">
                      {post.category === "newsletter" ? "📬" : "📊"}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                {post.category && (
                  <span className="text-xs font-medium uppercase tracking-wider text-accent">
                    {post.category === "newsletter"
                      ? "Past Newsletter"
                      : "Article"}
                  </span>
                )}
                <h3 className="mt-2 text-lg font-semibold text-primary group-hover:text-accent transition-colors">
                  {post.title}
                </h3>
                {post.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-secondary">
                    {post.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-accent">
                  <time dateTime={post.date}>
                    {new Date(post.date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                  <span>&middot;</span>
                  <span>{post.readingTime} min read</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
