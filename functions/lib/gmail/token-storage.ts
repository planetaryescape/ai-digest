import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { createLogger } from "../logger";

const log = createLogger("gmail-token-storage");

export interface TokenData {
  userId: string;
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
  updatedAt: string;
  lastUsed?: string;
}

const TABLE_NAME = process.env.OAUTH_TOKENS_TABLE || `${process.env.PROJECT_NAME || "ai-digest"}-oauth-tokens`;

let client: DynamoDBClient | null = null;

function getClient(): DynamoDBClient {
  if (!client) {
    client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return client;
}

/**
 * Get stored OAuth token from DynamoDB
 * Falls back to environment variable if not found in DB
 */
export async function getStoredToken(userId = "default"): Promise<TokenData | null> {
  try {
    const response = await getClient().send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: marshall({ userId }),
      })
    );

    if (response.Item) {
      const data = unmarshall(response.Item) as TokenData;
      log.info({ userId }, "Loaded token from DynamoDB");
      return data;
    }

    // Fall back to environment variable
    const envToken = process.env.GMAIL_REFRESH_TOKEN;
    if (envToken) {
      log.info("Using refresh token from environment variable");
      return {
        userId,
        refreshToken: envToken,
        updatedAt: "env",
      };
    }

    log.warn("No token found in DynamoDB or environment");
    return null;
  } catch (error) {
    log.error({ error }, "Failed to get token from DynamoDB");

    // Fall back to environment variable on error
    const envToken = process.env.GMAIL_REFRESH_TOKEN;
    if (envToken) {
      log.info("Falling back to environment variable token");
      return {
        userId,
        refreshToken: envToken,
        updatedAt: "env",
      };
    }

    return null;
  }
}

/**
 * Save OAuth token to DynamoDB
 */
export async function saveToken(data: Omit<TokenData, "updatedAt">): Promise<void> {
  const item: TokenData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  try {
    await getClient().send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: marshall(item, { removeUndefinedValues: true }),
      })
    );
    log.info({ userId: data.userId }, "Saved token to DynamoDB");
  } catch (error) {
    log.error({ error }, "Failed to save token to DynamoDB");
    throw error;
  }
}

/**
 * Update last used timestamp
 */
export async function updateLastUsed(userId = "default"): Promise<void> {
  try {
    const existing = await getStoredToken(userId);
    if (existing && existing.updatedAt !== "env") {
      await saveToken({
        ...existing,
        lastUsed: new Date().toISOString(),
      });
    }
  } catch (error) {
    // Non-critical, just log
    log.warn({ error }, "Failed to update last used timestamp");
  }
}
