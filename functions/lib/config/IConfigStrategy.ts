import type { App } from "../types";

export interface StorageConfig {
  type: "azure" | "s3" | "dynamodb";
  connectionString?: string;
  bucketName?: string;
  tableName?: string;
}

export interface EmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  recipientEmail: string;
}

export interface AIConfig {
  openAIKey: string;
  heliconeKey?: string;
  keywords: string[];
}

export interface IConfigStrategy {
  getBaseUrl(): string;
  getApps(): App[];
  getAIKeywords(): string[];
  getStorageConfig(): StorageConfig;
  getEmailConfig(): EmailConfig;
  getAIConfig(): AIConfig;
  getMaxEmailsPerBatch(): number;
  getMaxArticleFetchConcurrency(): number;
  getArticleFetchTimeout(): number;
}
