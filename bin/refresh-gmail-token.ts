#!/usr/bin/env bun

import { google } from "googleapis";
import readline from "readline";
import { config } from "../functions/lib/config";
import { GmailTokenManager } from "../functions/lib/gmail/token-manager";

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

async function refreshGmailToken() {
  console.log("🔄 Gmail Token Refresh Tool");
  console.log("============================\n");

  try {
    // Check if we have existing credentials
    const hasExistingConfig = config.gmail.clientId && config.gmail.clientSecret && config.gmail.refreshToken;
    
    if (hasExistingConfig) {
      console.log("📝 Found existing Gmail configuration");
      console.log("\nWhat would you like to do?");
      console.log("1. Test current token");
      console.log("2. Force refresh current token");
      console.log("3. Generate completely new token");
      console.log("4. Exit\n");

      const choice = await question("Enter your choice (1-4): ");

      switch (choice.trim()) {
        case "1":
          await testCurrentToken();
          break;
        case "2":
          await forceRefreshToken();
          break;
        case "3":
          await generateNewToken();
          break;
        case "4":
          console.log("\n👋 Goodbye!");
          break;
        default:
          console.log("\n❌ Invalid choice");
      }
    } else {
      console.log("⚠️  No existing Gmail configuration found");
      console.log("Let's set up a new Gmail OAuth token...\n");
      await generateNewToken();
    }
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : "Unknown error");
  } finally {
    rl.close();
  }
}

async function testCurrentToken() {
  console.log("\n🔍 Testing current token...");
  
  try {
    const tokenManager = new GmailTokenManager({
      clientId: config.gmail.clientId,
      clientSecret: config.gmail.clientSecret,
      refreshToken: config.gmail.refreshToken,
    });

    const result = await tokenManager.validateToken();
    
    if (result.isOk()) {
      const status = tokenManager.getTokenStatus();
      console.log("\n✅ Token is valid!");
      console.log(`⏰ Expires in: ${status.expiresIn ? Math.floor(status.expiresIn / 1000 / 60) : 0} minutes`);
      console.log(`🔄 Refresh attempts: ${status.refreshAttempts}`);
      
      if (status.lastRefreshAttempt) {
        console.log(`📅 Last refresh: ${status.lastRefreshAttempt.toISOString()}`);
      }
    } else {
      console.log("\n❌ Token validation failed:", result.error.message);
      console.log("\n💡 Recommendation: Try option 2 (Force refresh) or option 3 (Generate new token)");
    }
  } catch (error) {
    console.error("\n❌ Failed to test token:", error);
  }
}

async function forceRefreshToken() {
  console.log("\n🔄 Attempting to refresh token...");
  
  try {
    const tokenManager = new GmailTokenManager({
      clientId: config.gmail.clientId,
      clientSecret: config.gmail.clientSecret,
      refreshToken: config.gmail.refreshToken,
    });

    const result = await tokenManager.refreshAccessToken();
    
    if (result.isOk()) {
      console.log("\n✅ Token refreshed successfully!");
      
      const status = tokenManager.getTokenStatus();
      console.log(`⏰ New token expires in: ${status.expiresIn ? Math.floor(status.expiresIn / 1000 / 60) : 0} minutes`);
      
      // Validate the new token
      const validationResult = await tokenManager.validateToken();
      if (validationResult.isOk()) {
        console.log("✅ New token validated successfully!");
      } else {
        console.log("⚠️  Warning: Token refreshed but validation failed");
      }
    } else {
      console.log("\n❌ Token refresh failed:", result.error.message);
      console.log("\n💡 Recommendation: Generate a new token (option 3)");
    }
  } catch (error) {
    console.error("\n❌ Failed to refresh token:", error);
  }
}

async function generateNewToken() {
  console.log("\n🆕 Generating new OAuth token...");
  console.log("\n📋 Prerequisites:");
  console.log("1. Go to: https://console.cloud.google.com/apis/credentials");
  console.log("2. Create or select an OAuth 2.0 Client ID");
  console.log("3. Set application type to 'Desktop app'");
  console.log("4. Enable Gmail API in your project\n");

  // Get credentials
  let clientId = config.gmail.clientId;
  let clientSecret = config.gmail.clientSecret;

  if (!clientId || !clientSecret) {
    clientId = await question("Enter your OAuth Client ID: ");
    clientSecret = await question("Enter your OAuth Client Secret: ");
  } else {
    console.log("Using existing OAuth credentials from configuration");
    const useExisting = await question("Continue with existing credentials? (y/n): ");
    
    if (useExisting.toLowerCase() !== "y") {
      clientId = await question("Enter new OAuth Client ID: ");
      clientSecret = await question("Enter new OAuth Client Secret: ");
    }
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    clientId.trim(),
    clientSecret.trim(),
    "urn:ietf:wg:oauth:2.0:oob"
  );

  // Generate auth URL with proper scopes
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    prompt: "consent", // Force consent to ensure refresh token
  });

  console.log("\n🔗 Authorization URL:");
  console.log(authUrl);
  console.log("\n📝 Instructions:");
  console.log("1. Open the URL above in your browser");
  console.log("2. Log in with the Gmail account you want to use");
  console.log("3. Grant the requested permissions");
  console.log("4. Copy the authorization code from the page\n");

  const code = await question("Enter the authorization code: ");
  
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (!tokens.refresh_token) {
      throw new Error(
        "No refresh token received. Make sure you're using 'access_type: offline' and 'prompt: consent'"
      );
    }

    console.log("\n✅ Successfully generated tokens!");
    console.log("\n📝 Your new refresh token:");
    console.log(tokens.refresh_token);
    
    console.log("\n🔧 Update your environment variables:");
    console.log(`GMAIL_CLIENT_ID=${clientId.trim()}`);
    console.log(`GMAIL_CLIENT_SECRET=${clientSecret.trim()}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    
    if (process.env.AWS_REGION) {
      console.log("\n☁️  Update AWS Secrets Manager:");
      console.log(`aws secretsmanager update-secret --secret-id ai-digest-secrets --secret-string '{"GMAIL_REFRESH_TOKEN":"${tokens.refresh_token}"}'`);
    }
    
    // Test the new token
    console.log("\n🔍 Testing new token...");
    const tokenManager = new GmailTokenManager({
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      refreshToken: tokens.refresh_token,
    });
    
    const validationResult = await tokenManager.validateToken();
    if (validationResult.isOk()) {
      console.log("✅ New token validated successfully!");
    } else {
      console.log("⚠️  Warning: Token generated but validation failed:", validationResult.error.message);
    }
    
  } catch (error) {
    console.error("\n❌ Failed to generate token:", error instanceof Error ? error.message : error);
    console.log("\n💡 Common issues:");
    console.log("- Make sure the OAuth client type is 'Desktop app'");
    console.log("- Ensure Gmail API is enabled in your Google Cloud project");
    console.log("- Check that the authorization code hasn't expired (they're only valid for a few minutes)");
  }
}

// Run the script
refreshGmailToken();