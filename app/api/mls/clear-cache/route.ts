// Temporary endpoint to clear MLS cache
// DELETE this file after use for security

import { NextRequest, NextResponse } from "next/server";
import { clearAllCache } from "@/lib/mls/cache";

const AUTH_TOKEN = process.env.CRON_SECRET || "";

export async function POST(request: NextRequest) {
  // Check authorization
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token || token !== AUTH_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await clearAllCache();
    return NextResponse.json({
      success: true,
      message: "Cache cleared successfully"
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to clear cache",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
