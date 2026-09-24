#!/usr/bin/env bun

import { createServer } from "http";
import { google } from "googleapis";
import readline from "readline";

const REDIRECT_PORT = 3456;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

// Wait for OAuth callback on local server
const waitForCallback = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "", `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        server.close();
        reject(new Error(error));
        return;
      }

      if (code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authorization successful!</h1><p>You can close this tab.</p>");
        server.close();
        resolve(code);
        return;
      }

      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>Missing authorization code</h1>");
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`\n⏳ Waiting for authorization on port ${REDIRECT_PORT}...`);
    });

    server.on("error", (err) => {
      reject(new Error(`Server error: ${err.message}`));
    });
  });
};

async function generateOAuthToken() {
  try {
    // Get client credentials
    const clientId = await question("Enter your OAuth Client ID: ");
    const clientSecret = await question("Enter your OAuth Client Secret: ");

    // Create OAuth2 client with localhost redirect
    const oauth2Client = new google.auth.OAuth2(
      clientId.trim(),
      clientSecret.trim(),
      REDIRECT_URI
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
      prompt: "consent",
    });

    console.log("\n🔗 Open this URL in your browser:");
    console.log(authUrl);

    // Wait for callback
    const code = await waitForCallback();

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error(
        "No refresh token received. Make sure you're using the correct scope and access_type."
      );
    }

    console.log("\n✅ Successfully generated tokens!");
    console.log("\n📝 Your refresh token:");
    console.log(tokens.refresh_token);
    console.log("\n🔧 Update AWS Secrets Manager with:");
    console.log(
      `aws secretsmanager update-secret --secret-id ai-digest-secrets --secret-string '{"GMAIL_REFRESH_TOKEN":"${tokens.refresh_token}"}'`
    );
    console.log("\n💡 Or add to .env:");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : "Unknown error");
  } finally {
    rl.close();
  }
}

generateOAuthToken();
