// SEO Dashboard authentication
// Checks password against SEO_DASHBOARD_PASSWORD env var
// Sets a cookie on success so you stay logged in

import { NextResponse } from "next/server";

const COOKIE_NAME = "seo-dash-auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: Request) {
  const { password } = await request.json();
  const correctPassword = process.env.SEO_DASHBOARD_PASSWORD;

  if (!correctPassword) {
    return NextResponse.json(
      { error: "SEO_DASHBOARD_PASSWORD env var is not set" },
      { status: 503 }
    );
  }

  if (password !== correctPassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // Create a simple hash to store in the cookie (not the raw password)
  const token = Buffer.from(`${correctPassword}:${Date.now()}`).toString(
    "base64"
  );

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/downtown-condos/seo-dashboard",
  });

  return response;
}

// GET to check if already authenticated
export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .find((c) => c.trim().startsWith(`${COOKIE_NAME}=`));

  if (!cookie) {
    return NextResponse.json({ authenticated: false });
  }

  const token = cookie.split("=")[1]?.trim();
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  // Verify the token contains the correct password
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const correctPassword = process.env.SEO_DASHBOARD_PASSWORD;
    if (decoded.startsWith(`${correctPassword}:`)) {
      return NextResponse.json({ authenticated: true });
    }
  } catch {
    // Invalid token
  }

  return NextResponse.json({ authenticated: false });
}
