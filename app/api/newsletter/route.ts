import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, email, referralSource } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.MAILCHIMP_API_KEY;
    const listId = process.env.MAILCHIMP_LIST_ID;

    if (!apiKey || !listId) {
      console.error("[Newsletter API] MAILCHIMP_API_KEY or MAILCHIMP_LIST_ID not configured");
      return NextResponse.json(
        { error: "Newsletter service not configured" },
        { status: 500 }
      );
    }

    // Extract data center from API key (e.g., "abc123def-us21" -> "us21")
    const dc = apiKey.split("-").pop();

    const mailchimpResponse = await fetch(
      `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: email,
          status: "subscribed",
          merge_fields: {
            FNAME: firstName || "",
            ...(referralSource ? { REFERRAL: referralSource } : {}),
          },
        }),
      }
    );

    if (!mailchimpResponse.ok) {
      const errorData = await mailchimpResponse.json();

      // Handle "already subscribed" gracefully
      if (errorData.title === "Member Exists") {
        console.log("[Newsletter API] Already subscribed:", email);
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
        });
      }

      // Handle "Forgotten Email Not Subscribed" (GDPR compliance)
      if (errorData.title === "Forgotten Email Not Subscribed") {
        console.log("[Newsletter API] Forgotten email:", email);
        return NextResponse.json(
          { error: "This email was previously unsubscribed. Please contact jacob@jacobinaustin.com to resubscribe." },
          { status: 400 }
        );
      }

      console.error("[Newsletter API] Mailchimp error:", errorData);
      return NextResponse.json(
        { error: "Failed to subscribe. Please try again." },
        { status: 500 }
      );
    }

    console.log("[Newsletter API] Subscribed successfully:", email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Newsletter API] Error:", error);
    return NextResponse.json(
      { error: "Failed to process subscription" },
      { status: 500 }
    );
  }
}
