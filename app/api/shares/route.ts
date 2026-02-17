import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { unstable_noStore as noStore } from "next/cache";

interface ShareEvent {
  timestamp: string;
  url: string;
  pageType: string;
  listingId?: string;
  buildingSlug?: string;
  method: string;
}

const SHARES_KEY = "shares:log";
const MAX_SHARE_LOG = 500;

/**
 * POST /api/shares — Log a share event (public, no auth)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, pageType, listingId, buildingSlug, method } = body;

    if (!url || !pageType) {
      return NextResponse.json(
        { error: "url and pageType required" },
        { status: 400 }
      );
    }

    const event: ShareEvent = {
      timestamp: new Date().toISOString(),
      url,
      pageType,
      listingId: listingId || undefined,
      buildingSlug: buildingSlug || undefined,
      method: method || "unknown",
    };

    // Push to front of list; trim to cap size
    await kv.lpush(SHARES_KEY, JSON.stringify(event));
    await kv.ltrim(SHARES_KEY, 0, MAX_SHARE_LOG - 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Shares API] Error logging share:", error);
    return NextResponse.json(
      { error: "Failed to log share" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/shares — View share data (CRON_SECRET auth required)
 */
export async function GET(request: NextRequest) {
  noStore();

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  const AUTH_TOKEN = process.env.CRON_SECRET || "";

  if (!token || token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawEvents = await kv.lrange(SHARES_KEY, 0, -1);
    const events: ShareEvent[] = rawEvents.map((e: unknown) =>
      typeof e === "string" ? JSON.parse(e) : (e as ShareEvent)
    );

    // Summary stats
    const total = events.length;
    const byPageType: Record<string, number> = {};
    const byMethod: Record<string, number> = {};
    for (const event of events) {
      byPageType[event.pageType] = (byPageType[event.pageType] || 0) + 1;
      byMethod[event.method] = (byMethod[event.method] || 0) + 1;
    }

    return NextResponse.json({
      total,
      byPageType,
      byMethod,
      recentEvents: events.slice(0, 50),
    });
  } catch (error) {
    console.error("[Shares API] Error reading shares:", error);
    return NextResponse.json(
      { error: "Failed to read shares" },
      { status: 500 }
    );
  }
}
