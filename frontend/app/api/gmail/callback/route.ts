import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { NextResponse } from "next/server";
import { getDynamoDBClient } from "@/lib/aws/clients";

export const runtime = "nodejs";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle OAuth errors
    if (error) {
      return renderErrorPage(`OAuth error: ${error}`);
    }

    if (!code) {
      return renderErrorPage("No authorization code received");
    }

    // Verify state token (CSRF protection)
    const cookies = request.headers.get("cookie") || "";
    const stateCookie = cookies
      .split(";")
      .find((c) => c.trim().startsWith("gmail_oauth_state="));
    const storedState = stateCookie?.split("=")[1]?.trim();

    if (!storedState || storedState !== state) {
      return renderErrorPage("Invalid state token. Please try again.");
    }

    // Exchange code for tokens
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return renderErrorPage("Gmail credentials not configured");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/gmail/callback`;

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return renderErrorPage("Failed to exchange authorization code");
    }

    const tokens: TokenResponse = await tokenResponse.json();

    if (!tokens.refresh_token) {
      return renderErrorPage(
        "No refresh token received. This might happen if you've already authorized this app. " +
        "Try revoking access at https://myaccount.google.com/permissions and try again."
      );
    }

    // Save token to DynamoDB
    const tableName = process.env.OAUTH_TOKENS_TABLE || "ai-digest-oauth-tokens";
    const dynamoClient = getDynamoDBClient();

    const tokenData = {
      userId: "default",
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      updatedAt: new Date().toISOString(),
    };

    await dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(tokenData),
      })
    );

    // Clear state cookie and render success page
    const response = renderSuccessPage();
    response.cookies.delete("gmail_oauth_state");
    return response;
  } catch (error) {
    console.error("Gmail callback error:", error);
    return renderErrorPage("An unexpected error occurred. Please try again.");
  }
}

function renderSuccessPage(): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Gmail Connected</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          .success-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 { color: #1a1a1a; margin-bottom: 10px; }
          p { color: #666; line-height: 1.6; }
          .close-btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #0066CC;
            color: white;
            border-radius: 6px;
            text-decoration: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">&#10003;</div>
          <h1>Gmail Connected!</h1>
          <p>Your Gmail access has been successfully re-authorized. Your next scheduled digest will run normally.</p>
          <button class="close-btn" onclick="window.close()">Close Window</button>
        </div>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function renderErrorPage(message: string): NextResponse {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Gmail Connection Failed</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
            color: #dc2626;
          }
          h1 { color: #1a1a1a; margin-bottom: 10px; }
          p { color: #666; line-height: 1.6; }
          .error-message {
            background: #FEF2F2;
            border: 1px solid #FECACA;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            color: #991B1B;
          }
          .retry-btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background: #0066CC;
            color: white;
            border-radius: 6px;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">&#10007;</div>
          <h1>Connection Failed</h1>
          <div class="error-message">${message}</div>
          <a href="/api/gmail/connect" class="retry-btn">Try Again</a>
        </div>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    status: 400,
    headers: { "Content-Type": "text/html" },
  });
}
