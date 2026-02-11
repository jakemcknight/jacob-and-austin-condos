import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, interest, message, buildingName } = body;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Build email content
    const emailSubject = buildingName
      ? `Inquiry about ${buildingName}`
      : "Downtown Austin Condos Inquiry";

    const emailBody = `
New inquiry from Jacob In Austin website:

Name: ${name}
Email: ${email}
Phone: ${phone || "Not provided"}
Interest: ${interest}
Building: ${buildingName || "General inquiry"}

Message:
${message || "No message provided"}

---
Sent from jacobinaustin.com contact form
    `.trim();

    // Use Resend API to send email
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error("[Contact API] RESEND_API_KEY not configured");
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Jacob In Austin <onboarding@resend.dev>",
        to: ["jacob@jacobinaustin.com"],
        reply_to: email,
        subject: emailSubject,
        text: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text();
      console.error("[Contact API] Resend error:", errorData);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    const data = await resendResponse.json();
    console.log("[Contact API] Email sent successfully:", data.id);

    return NextResponse.json({ success: true, messageId: data.id });
  } catch (error) {
    console.error("[Contact API] Error:", error);
    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 }
    );
  }
}
