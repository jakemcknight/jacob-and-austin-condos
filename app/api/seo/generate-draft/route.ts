// AI Blog Draft Generation API
// POST { topic: string, keywords?: string[] }
// Returns a generated MDX draft ready for review

import { NextResponse } from "next/server";
import { generateDraft } from "@/lib/seo/draft-generator";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, keywords, sourceGap } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "Missing 'topic' in request body" },
        { status: 400 }
      );
    }

    console.log(`[Draft Generator] Generating draft for: "${topic}"`);

    const draft = await generateDraft(
      topic,
      keywords || [],
      sourceGap
    );

    console.log(`[Draft Generator] Draft generated: ${draft.slug} (${draft.content.length} chars)`);

    return NextResponse.json({
      success: true,
      slug: draft.slug,
      topic: draft.topic,
      status: draft.status,
      contentLength: draft.content.length,
      content: draft.content,
    });
  } catch (error) {
    console.error("[Draft Generator] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        {
          error: "Claude API not configured",
          message: "Set ANTHROPIC_API_KEY env var to enable AI draft generation.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Draft generation failed", message },
      { status: 500 }
    );
  }
}
