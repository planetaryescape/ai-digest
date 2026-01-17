import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { OAuth2Client } from "google-auth-library";
import { type gmail_v1, google } from "googleapis";
import { BATCH_LIMITS, RATE_LIMITS } from "../constants";
import type { CostTracker } from "../cost-tracker";
import { GmailBatchOperations } from "../gmail-batch-operations";
import { getStoredToken, updateLastUsed } from "../gmail/token-storage";
import { createLogger } from "../logger";

const log = createLogger("EmailFetcherAgent");

export type AuthErrorType = "INVALID_REFRESH_TOKEN" | "AUTH_FAILED" | "NO_CREDENTIALS";

export interface FetchEmailsOptions {
  mode: "weekly" | "cleanup" | "historical";
  batchSize?: number;
  cleanup?: boolean;
  executionId?: string;
  startDate?: string;
  endDate?: string;
}

export interface EmailBatch {
  fullEmails: any[];
  metadata: any[];
  aiEmailIds: string[];
  unknownEmailIds: string[];
  classifications: Map<string, any>;
  stats: {
    totalFetched?: number;
    knownAI?: number;
    knownNonAI?: number;
    unknown?: number;
    archived?: number;
  };
  authError?: {
    type: AuthErrorType;
    message: string;
  };
}

export class EmailFetcherAgent {
  private gmail?: gmail_v1.Gmail;
  private oauth2Client: OAuth2Client;
  private dynamodb: DynamoDBDocumentClient;
  private batchOps!: GmailBatchOperations;
  private initialized = false;
  private stats = {
    emailsFetched: 0,
    apisCallsMade: 0,
    errors: 0,
  };

  constructor(private costTracker: CostTracker) {
    // Initialize OAuth2 client
    this.oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      "urn:ietf:wg:oauth:2.0:oob"
    );

    // Initialize DynamoDB
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.dynamodb = DynamoDBDocumentClient.from(dynamoClient);
  }

  /**
   * Initialize Gmail client with token from DynamoDB or env var
   */
  private async initialize(): Promise<{ error?: { type: AuthErrorType; message: string } }> {
    if (this.initialized) {
      return {};
    }

    // Try to get token from DynamoDB first, fall back to env var
    const tokenData = await getStoredToken();

    if (!tokenData) {
      return {
        error: {
          type: "NO_CREDENTIALS",
          message: "No Gmail credentials found. Please run 'bun run generate:oauth' or re-authorize via the dashboard.",
        },
      };
    }

    this.oauth2Client.setCredentials({
      refresh_token: tokenData.refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    this.batchOps = new GmailBatchOperations(this.gmail, this.costTracker);
    this.initialized = true;

    return {};
  }

  async fetchEmails(options: FetchEmailsOptions): Promise<EmailBatch> {
    const emptyBatch: EmailBatch = {
      fullEmails: [],
      metadata: [],
      aiEmailIds: [],
      unknownEmailIds: [],
      classifications: new Map(),
      stats: { totalFetched: 0 },
    };

    // Initialize and check for auth errors
    const initResult = await this.initialize();
    if (initResult.error) {
      log.error({ error: initResult.error }, "Gmail initialization failed");
      return { ...emptyBatch, authError: initResult.error };
    }

    if (!this.gmail) {
      return {
        ...emptyBatch,
        authError: {
          type: "NO_CREDENTIALS",
          message: "Gmail client not initialized",
        },
      };
    }

    log.info({ options }, "Fetching emails");
    const startTime = Date.now();

    try {
      // Build query based on mode
      const query = this.buildQuery(options);

      // Fetch messages
      const messages = await this.fetchMessages(query, options.batchSize);

      // Fetch full message details
      const fullEmails = await this.fetchFullMessages(messages);

      // Check senders against known lists
      const categorizedEmails = await this.categorizeBySender(fullEmails);

      // Archive emails if in cleanup mode
      if (options.cleanup) {
        await this.archiveEmails(categorizedEmails.aiEmailIds);
      }

      const stats = {
        totalFetched: fullEmails.length,
        knownAI: categorizedEmails.aiEmailIds.length,
        knownNonAI: categorizedEmails.knownNonAICount,
        unknown: categorizedEmails.unknownEmailIds.length,
        archived: options.cleanup ? categorizedEmails.aiEmailIds.length : 0,
      };

      log.info({ stats, duration: Date.now() - startTime }, "Email fetch complete");

      // Update last used timestamp on success
      await updateLastUsed();

      return {
        fullEmails: categorizedEmails.emails,
        metadata: categorizedEmails.metadata,
        aiEmailIds: categorizedEmails.aiEmailIds,
        unknownEmailIds: categorizedEmails.unknownEmailIds,
        classifications: new Map(),
        stats,
      };
    } catch (error: any) {
      this.stats.errors++;
      log.error({ error }, "Email fetch failed");

      // Check for auth-related errors
      const errorMessage = error?.message || String(error);
      const errorCode = error?.code;

      if (
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("Token has been expired or revoked") ||
        errorMessage.includes("refresh token") ||
        errorCode === 401
      ) {
        return {
          ...emptyBatch,
          authError: {
            type: "INVALID_REFRESH_TOKEN",
            message: "Gmail refresh token is invalid or expired. Please re-authorize via the dashboard.",
          },
        };
      }

      if (errorCode === 403 || errorMessage.includes("Forbidden")) {
        return {
          ...emptyBatch,
          authError: {
            type: "AUTH_FAILED",
            message: "Gmail API access denied. Please check API permissions and re-authorize.",
          },
        };
      }

      // Re-throw non-auth errors
      throw error;
    }
  }

  private buildQuery(options: FetchEmailsOptions): string {
    let query = "in:inbox";

    if (options.mode === "weekly") {
      // Fetch emails from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query += ` after:${weekAgo.toISOString().split("T")[0]}`;
    } else if (options.mode === "cleanup") {
      // Fetch older emails for cleanup
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      query += ` after:${monthAgo.toISOString().split("T")[0]}`;
      query += ` before:${weekAgo.toISOString().split("T")[0]}`;
    } else if (options.mode === "historical" && options.startDate && options.endDate) {
      query += ` after:${options.startDate} before:${options.endDate}`;
    }

    return query;
  }

  private async fetchMessages(query: string, maxResults?: number): Promise<any[]> {
    const messages: any[] = [];
    let pageToken: string | undefined;
    const batchSize = maxResults || BATCH_LIMITS.GMAIL_API;

    do {
      const response = await this.gmail?.users.messages.list({
        userId: "me",
        q: query,
        maxResults: Math.min(batchSize, BATCH_LIMITS.GMAIL_API),
        pageToken,
      });

      this.stats.apisCallsMade++;
      this.costTracker.recordApiCall("gmail", "list");

      if (response.data.messages) {
        messages.push(...response.data.messages);
      }

      pageToken = response.data.nextPageToken || undefined;

      // Stop if we've reached the desired number
      if (maxResults && messages.length >= maxResults) {
        break;
      }

      // Rate limiting
      if (pageToken) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.GMAIL_BATCH_DELAY_MS));
      }
    } while (pageToken);

    return messages.slice(0, maxResults);
  }

  private async fetchFullMessages(messages: any[]): Promise<any[]> {
    if (!messages.length) {
      return [];
    }

    const fullEmails = await this.batchOps.batchGetMessages(messages.map((m) => m.id));

    this.stats.emailsFetched += fullEmails.length;

    return fullEmails.map((msg) => this.parseMessage(msg));
  }

  private parseMessage(message: any): any {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    return {
      id: message.id,
      threadId: message.threadId,
      subject: getHeader("subject"),
      sender: getHeader("from"),
      date: getHeader("date"),
      snippet: message.snippet,
      body: this.extractBody(message.payload),
    };
  }

  private extractBody(payload: any): string {
    if (!payload) {
      return "";
    }

    // Check for plain text part
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Check for HTML part
    if (payload.mimeType === "text/html" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Recursively check parts
    if (payload.parts) {
      for (const part of payload.parts) {
        const body = this.extractBody(part);
        if (body) {
          return body;
        }
      }
    }

    return "";
  }

  private async categorizeBySender(emails: any[]): Promise<any> {
    const knownAISenders = await this.getKnownSenders("ai-digest-known-ai-senders");
    const knownNonAISenders = await this.getKnownSenders("ai-digest-known-non-ai-senders");

    const aiEmailIds: string[] = [];
    const unknownEmailIds: string[] = [];
    let knownNonAICount = 0;

    const categorizedEmails = emails.map((email) => {
      const senderEmail = this.extractEmailAddress(email.sender);

      if (knownAISenders.has(senderEmail)) {
        aiEmailIds.push(email.id);
        return { ...email, isKnownAI: true };
      }
      if (knownNonAISenders.has(senderEmail)) {
        knownNonAICount++;
        return { ...email, isKnownNonAI: true };
      }
      unknownEmailIds.push(email.id);
      return { ...email, isUnknown: true };
    });

    const metadata = emails.map((email) => ({
      id: email.id,
      subject: email.subject,
      sender: email.sender,
      date: email.date,
    }));

    return {
      emails: categorizedEmails,
      metadata,
      aiEmailIds,
      unknownEmailIds,
      knownNonAICount,
    };
  }

  private async getKnownSenders(tableName: string): Promise<Set<string>> {
    const senders = new Set<string>();

    // Skip DynamoDB operations when using mock storage or tables don't exist
    if (process.env.STORAGE_TYPE === "s3" || process.env.STORAGE_TYPE === "mock") {
      log.debug("Skipping DynamoDB sender lookup - using mock storage");
      return senders;
    }

    try {
      const response = await this.dynamodb.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: {
            ":pk": "SENDER",
          },
        })
      );

      if (response.Items) {
        response.Items.forEach((item) => {
          if (item.email) {
            senders.add(item.email.toLowerCase());
          }
        });
      }
    } catch (error) {
      log.warn({ error, tableName }, "Failed to fetch known senders");
    }

    return senders;
  }

  private extractEmailAddress(sender: string): string {
    const match = sender.match(/<(.+?)>/) || sender.match(/([^\s]+@[^\s]+)/);
    return match ? match[1].toLowerCase() : sender.toLowerCase();
  }

  private async archiveEmails(emailIds: string[]): Promise<void> {
    if (!emailIds.length) {
      return;
    }

    await this.batchOps.batchModifyMessages(emailIds, {
      removeLabelIds: ["INBOX"],
    });

    log.info({ count: emailIds.length }, "Archived emails");
  }

  getStats() {
    return { ...this.stats };
  }

  getBatchOperations(): GmailBatchOperations {
    return this.batchOps;
  }
}
