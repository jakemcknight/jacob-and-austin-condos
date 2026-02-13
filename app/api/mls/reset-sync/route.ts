// Reset MLS sync state - forces the next sync to be a full initial import
// Does NOT clear cached listing data, so existing listings remain available until replaced

import { NextRequest, NextResponse } from "next/server";
import { resetSyncState } from "@/lib/mls/sync-state";

export const dynamic = "force-dynamic";

const AUTH_TOKEN = process.env.CRON_SECRET || "";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await resetSyncState();
    return NextResponse.json({
      success: true,
      message: "Sync state reset. Next sync will be a full initial import.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reset sync state",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
