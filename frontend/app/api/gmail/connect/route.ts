import crypto from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

export async function GET(request: Request) {
  try {
    // Verify secret token for security
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const expectedSecret = process.env.GMAIL_REAUTH_SECRET;

    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = process.env.GMAIL_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "Gmail client ID not configured" }, { status: 500 });
    }

    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // Store state in a cookie for validation in callback
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/gmail/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent", // Force consent to ensure refresh token
      state,
    });

    const authUrl = `${GOOGLE_OAUTH_URL}?${params.toString()}`;

    // Set state cookie and redirect
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error("Gmail connect error:", error);
    return NextResponse.json({ error: "Failed to initiate OAuth flow" }, { status: 500 });
  }
}
