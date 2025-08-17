#!/usr/bin/env bun

import { google } from "googleapis";
import readline from "readline";

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

async function generateOAuthToken() {
  try {
    // Get client credentials
    const clientId = await question("Enter your OAuth Client ID: ");
    const clientSecret = await question("Enter your OAuth Client Secret: ");

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId.trim(),
      clientSecret.trim(),
      "urn:ietf:wg:oauth:2.0:oob" // Redirect URI for desktop apps
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      // biome-ignore lint/style/useNamingConvention: OAuth2 API requirement
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/gmail.modify"],
      prompt: "consent", // Force consent to ensure refresh token is returned
    });

    console.log("\n🔗 Open this URL in your browser to authorize the application:");
    console.log(authUrl);
    console.log("\n");

    // Get authorization code
    const code = await question("Enter the authorization code from the page: ");
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      throw new Error(
        "No refresh token received. Make sure you're using the correct scope and access_type."
      );
    }

    console.log("\n✅ Successfully generated tokens!");
    console.log("\n📝 Your refresh token:");
    console.log(tokens.refresh_token);
    console.log("\n🔧 Update it in Key Vault with:");
    console.log(
      `az keyvault secret set --vault-name kv-ai-digest-unique --name gmail-refresh-token --value "${tokens.refresh_token}"`
    );
    console.log("\n💡 You can also add it to your .env file:");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : "Unknown error");
  } finally {
    rl.close();
  }
}

// Run the script
generateOAuthToken();
