import type { App } from "../types";
import type { AIConfig, EmailConfig, IConfigStrategy, StorageConfig } from "./IConfigStrategy";

export class DevelopmentConfig implements IConfigStrategy {
  getBaseUrl(): string {
    return "http://localhost:3000";
  }

  getApps(): App[] {
    // Smaller list for dev testing
    return [
      { name: "GitHub", icon: "https://github.githubassets.com/favicons/favicon.png" },
      { name: "OpenAI", icon: "https://openai.com/favicon.ico" },
      {
        name: "TechCrunch",
        icon: "https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png",
      },
    ];
  }

  getAIKeywords(): string[] {
    // Smaller list for dev testing
    return [
      "artificial intelligence",
      "machine learning",
      "AI",
      "ML",
      "ChatGPT",
      "GPT-4",
      "Claude",
      "OpenAI",
      "Anthropic",
      "neural network",
      "deep learning",
      "LLM",
      "transformer",
    ];
  }

  getStorageConfig(): StorageConfig {
    // Default to S3 for development
    return {
      type: "s3",
      bucketName: process.env.S3_BUCKET || "ai-digest-dev",
    };
  }

  getEmailConfig(): EmailConfig {
    return {
      clientId: process.env.GMAIL_CLIENT_ID || "dev-client-id",
      clientSecret: process.env.GMAIL_CLIENT_SECRET || "dev-client-secret",
      refreshToken: process.env.GMAIL_REFRESH_TOKEN || "dev-refresh-token",
      recipientEmail: process.env.RECIPIENT_EMAIL || "dev@example.com",
    };
  }

  getAIConfig(): AIConfig {
    return {
      openAIKey: process.env.OPENAI_API_KEY || "dev-openai-key",
      heliconeKey: process.env.HELICONE_API_KEY,
      keywords: this.getAIKeywords(),
    };
  }

  getMaxEmailsPerBatch(): number {
    return 10; // Smaller batches for testing
  }

  getMaxArticleFetchConcurrency(): number {
    return 2; // Lower concurrency for development
  }

  getArticleFetchTimeout(): number {
    return 10000; // 10 seconds for faster dev feedback
  }
}
