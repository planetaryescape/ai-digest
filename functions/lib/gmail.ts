import { type gmail_v1, google } from "googleapis";
import { Result } from "neverthrow";
// TODO: Implement these missing modules
// import { DynamoDBSenderTracker } from "./aws/dynamodb-sender-tracker";
import { config } from "./config";
import { enhancedExtractArticleData, extractUrlsFromEmail } from "./extract";
// import {
//   AIClassificationStrategy,
//   BatchAIClassificationStrategy,
// } from "./gmail/ai-classification-strategy";
// import {
//   AIDetectionStrategyFactory,
//   type CompositeAIDetectionStrategy,
// } from "./gmail/ai-detection-strategies";
import { GmailTokenManager } from "./gmail/token-manager";
// import type { ISenderTracker } from "./interfaces/sender-tracker";
import { createLogger, createTimer } from "./logger";
import type { Article, EmailItem } from "./types";

const log = createLogger("gmail");

export class GmailClient {
  private gmail: gmail_v1.Gmail;
  private oauth2Client: any; // Google OAuth2 client
  private tokenManager: GmailTokenManager;
  // private senderTracker: ISenderTracker;
  // private aiDetectionStrategy: CompositeAIDetectionStrategy;
  // private aiClassificationStrategy: AIClassificationStrategy;
  // private batchClassificationStrategy: BatchAIClassificationStrategy;
  private lastTokenRefresh: number = 0;

  constructor() {
    // Initialize token manager
    this.tokenManager = new GmailTokenManager({
      clientId: config.gmail.clientId,
      clientSecret: config.gmail.clientSecret,
      refreshToken: config.gmail.refreshToken,
    });

    this.oauth2Client = this.tokenManager.getOAuth2Client();
    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
    // this.senderTracker = new DynamoDBSenderTracker();

    // // Initialize AI detection strategy (fallback)
    // this.aiDetectionStrategy = AIDetectionStrategyFactory.createDefault(
    //   config.aiKeywords,
    //   config.additionalKeywords,
    //   this.senderTracker
    // );

    // // Initialize AI classification strategies
    // this.aiClassificationStrategy = new AIClassificationStrategy(
    //   config.openai.models.classification
    // );
    // this.batchClassificationStrategy = new BatchAIClassificationStrategy(
    //   config.openai.models.classification
    // );
  }

  /**
   * Execute Gmail API call with automatic token refresh on auth failure
   */
  private async executeWithRetry<T>(apiCall: () => Promise<T>, operation: string): Promise<T> {
    try {
      return await apiCall();
    } catch (error: any) {
      const errorCode = error?.code;
      const errorMessage = error?.message || "";

      // Check if error is auth-related
      if (
        errorCode === 401 ||
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("Token has been expired or revoked")
      ) {
        log.warn(`Auth error during ${operation}, attempting token refresh`);

        // Try to refresh the token
        const refreshResult = await this.tokenManager.refreshAccessToken();

        if (refreshResult.isErr()) {
          log.error({ error: refreshResult.error }, `Failed to refresh token for ${operation}`);
          throw new Error(
            `Gmail authentication failed: ${refreshResult.error.message}. ` +
              `Please run 'bun run generate:oauth' to get a new refresh token.`
          );
        }

        // Retry the API call with the new token
        log.info(`Retrying ${operation} after token refresh`);
        return await apiCall();
      }

      // For non-auth errors, just throw
      throw error;
    }
  }

  /**
   * Validate Gmail access before processing
   */
  async validateAccess(): Promise<Result<boolean>> {
    return await this.tokenManager.validateToken();
  }

  /**
   * Get token status for monitoring
   */
  getTokenStatus() {
    return this.tokenManager.getTokenStatus();
  }

  /**
   * Check if an email is AI-related using strategy pattern
   */
  private async isAIRelated(subject: string, sender: string): Promise<boolean> {
    // First check if sender is already known
    const senderEmail = this.extractEmailAddress(sender);
    if (senderEmail) {
      // TODO: Implement sender tracking
      const isKnown = false; // await this.senderTracker.isKnownAISender(senderEmail);
      if (isKnown) {
        log.debug(`Known AI sender: ${senderEmail}`);
        return true;
      }
    }

    // For unknown senders, use AI classification
    try {
      // TODO: Implement AI classification
      const isAI = false; // await this.aiClassificationStrategy.detect(subject, sender, this.senderTracker);

      if (isAI && senderEmail) {
        log.debug(`AI email detected via classification from: ${senderEmail}`);
      }

      return isAI;
    } catch (error) {
      // Fallback to keyword detection if AI classification fails
      log.debug({ error }, "AI classification failed, falling back to keyword detection");
      // TODO: Implement AI detection strategy
      const isAI = false; // await this.aiDetectionStrategy.detect(subject, sender, this.senderTracker);

      if (isAI && senderEmail) {
        log.debug(`AI email detected via keywords from: ${senderEmail}`);
      }

      return isAI;
    }
  }

  /**
   * Extract email address from sender string
   */
  private extractEmailAddress(sender: string): string | null {
    const match = sender.match(/<([^>]+)>/);
    if (match) {
      return match[1].toLowerCase();
    }
    // If no angle brackets, assume the whole string is the email
    if (sender.includes("@")) {
      return sender.toLowerCase();
    }
    return null;
  }

  /**
   * Get header value from Gmail message headers
   */
  private getHeaderValue(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
    const header = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || "";
  }

  /**
   * List messages matching a query
   */
  async listMessages(query: string, maxResults: number = 500): Promise<string[]> {
    const messageIds: string[] = [];
    let pageToken: string | undefined;

    while (messageIds.length < maxResults) {
      const response = await this.executeWithRetry(
        () =>
          this.gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults: Math.min(500, maxResults - messageIds.length),
            pageToken,
          }),
        "listMessages"
      );

      const messages = response.data.messages || [];
      messageIds.push(...messages.map((m) => m.id).filter((id): id is string => Boolean(id)));

      pageToken = response.data.nextPageToken || undefined;
      if (!pageToken) {
        break;
      }
    }

    return messageIds;
  }

  /**
   * Get full message by ID
   */
  async getMessage(messageId: string): Promise<gmail_v1.Schema$Message> {
    const response = await this.executeWithRetry(
      () =>
        this.gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full",
        }),
      "getMessage"
    );
    return response.data;
  }

  /**
   * Get metadata for a message (lighter than full message)
   */
  async getMessageMetadata(messageId: string): Promise<gmail_v1.Schema$Message> {
    const response = await this.executeWithRetry(
      () =>
        this.gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        }),
      "getMessageMetadata"
    );
    return response.data;
  }

  /**
   * Batch modify messages (archive, mark as read, etc.)
   */
  async batchModify(
    messageIds: string[],
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }

    await this.executeWithRetry(
      () =>
        this.gmail.users.messages.batchModify({
          userId: "me",
          requestBody: {
            ids: messageIds,
            addLabelIds,
            removeLabelIds,
          },
        }),
      "batchModify"
    );
  }

  /**
   * Archive messages (remove from INBOX)
   */
  async archiveMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }

    // Process in batches to avoid API limits
    const batchSize = 100;
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      await this.batchModify(batch, [], ["INBOX"]);
      log.info(`Archived batch of ${batch.length} messages`);
    }
  }

  /**
   * Mark messages as read and archive them
   */
  async markReadAndArchive(messageIds: string[]): Promise<void> {
    await this.batchModify(messageIds, [], ["UNREAD", "INBOX"]);
  }

  /**
   * Get the sender tracker instance
   */
  // TODO: Implement sender tracker
  // getSenderTracker(): ISenderTracker {
  //   return this.senderTracker;
  // }

  /**
   * Extract URLs from email and fetch article data
   */
  private async fetchEmailArticles(
    payload: gmail_v1.Schema$MessagePart | undefined
  ): Promise<Article[]> {
    const urls = extractUrlsFromEmail(payload);
    const limitedUrls = urls.slice(0, config.maxLinksPerEmail);

    // Use enhanced extraction with AI insights
    const useAI = config.openai.models.extraction !== "gpt-3.5-turbo"; // Use AI insights with o4-mini unless using legacy model
    const articles = await Promise.all(
      limitedUrls.map((url) => enhancedExtractArticleData(url, useAI))
    );

    return articles.filter((a) => a !== null) as Article[];
  }

  /**
   * Build Gmail link for an email
   */
  private buildGmailLink(messageId: string): string {
    return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
  }

  /**
   * Process multiple email messages with batch AI classification
   * More efficient than individual classification
   */
  private async processEmailMessagesWithBatchClassification(
    messageIds: string[],
    context: string
  ): Promise<EmailItem[]> {
    const timer = createTimer(log, "batch-classification");
    const items: EmailItem[] = [];

    // First, fetch metadata for all emails
    const emailsMetadata: Array<{
      id: string;
      subject: string;
      sender: string;
      date: string;
    }> = [];

    log.info(`Fetching metadata for ${messageIds.length} emails...`);

    for (const messageId of messageIds) {
      try {
        const message = await this.getMessageMetadata(messageId);
        const headers = message.payload?.headers || [];
        const subject = this.getHeaderValue(headers, "Subject");
        const sender = this.getHeaderValue(headers, "From");
        const date = this.getHeaderValue(headers, "Date");

        emailsMetadata.push({ id: messageId, subject, sender, date });
      } catch (_error) {
        log.debug({ messageId }, "Error fetching message metadata, skipping");
      }
    }

    // Separate known senders from unknown
    const knownSenders: Set<string> = new Set();
    const unknownEmails: typeof emailsMetadata = [];

    for (const email of emailsMetadata) {
      const senderEmail = this.extractEmailAddress(email.sender);
      // TODO: Implement sender tracking
      if (false) { // if (senderEmail && (await this.senderTracker.isKnownAISender(senderEmail))) {
        knownSenders.add(email.id);
      } else {
        unknownEmails.push(email);
      }
    }

    log.info(
      `Found ${knownSenders.size} emails from known AI senders, ` +
        `${unknownEmails.length} need classification`
    );

    // TODO: Implement batch classification
    // Batch classify only unknown senders
    const classifications = new Map<string, boolean>(); // =
      // unknownEmails.length > 0
      //   ? await this.batchClassificationStrategy.classifyBatch(unknownEmails)
      //   : new Map<string, boolean>();

    // Process AI-related emails (both known and newly classified)
    const aiEmailIds = emailsMetadata
      .filter((email) => knownSenders.has(email.id) || classifications.get(email.id) === true)
      .map((email) => email.id);

    log.info(`Found ${aiEmailIds.length} AI-related emails out of ${emailsMetadata.length}`);

    // Fetch full details for AI emails
    for (const messageId of aiEmailIds) {
      try {
        const message = await this.getMessage(messageId);
        const headers = message.payload?.headers || [];
        const subject = this.getHeaderValue(headers, "Subject");
        const sender = this.getHeaderValue(headers, "From");
        const date = this.getHeaderValue(headers, "Date");

        // Extract and fetch article data
        const articles = await this.fetchEmailArticles(message.payload);

        items.push({
          id: messageId,
          sender,
          subject,
          date,
          articles,
          gmailLink: this.buildGmailLink(messageId),
          body: message.snippet || "",
          threadId: message.threadId || messageId,
          snippet: message.snippet || "",
        });

        // Update sender tracker for confirmed AI emails
        const senderEmail = this.extractEmailAddress(sender);
        if (senderEmail) {
          // TODO: Implement sender tracking
          // await this.senderTracker.addConfirmedSender({ email: senderEmail });
        }
      } catch (_error) {
        log.debug({ messageId }, "Error processing AI email, skipping");
      }
    }

    timer.end({
      totalMessages: messageIds.length,
      classifiedMessages: emailsMetadata.length,
      aiMessages: items.length,
    });

    log.info(
      { totalMessages: messageIds.length, aiMessages: items.length, context },
      `Completed batch processing ${context} emails`
    );

    return items;
  }

  /**
   * Get weekly AI-related emails using batch AI classification
   */
  async getWeeklyAIEmails(): Promise<EmailItem[]> {
    const timer = createTimer(log, "get-weekly-ai-emails");

    // Query for ALL emails in inbox from last 7 days (no keyword filtering)
    const messageIds = await this.listMessages("in:inbox newer_than:7d");
    log.info({ messageCount: messageIds.length }, "Listed inbox messages from last 7 days");

    // Use batch classification for efficiency
    const items = await this.processEmailMessagesWithBatchClassification(messageIds, "weekly AI");

    timer.end({ totalMessages: messageIds.length, aiMessages: items.length });
    return items;
  }

  /**
   * Get ALL AI-related emails from inbox (not archived)
   * Used for cleanup mode to process all unarchived AI emails
   */
  async getAllAIEmails(): Promise<EmailItem[]> {
    const timer = createTimer(log, "get-all-ai-emails");

    // Query for ALL emails in inbox (not archived)
    const messageIds = await this.listMessages("in:inbox", 2000);
    log.info({ messageCount: messageIds.length }, "Listed all inbox messages");

    // Use batch classification for efficiency
    const items = await this.processEmailMessagesWithBatchClassification(messageIds, "all AI");

    timer.end({ totalMessages: messageIds.length, aiMessages: items.length });
    return items;
  }

  /**
   * Archive old AI emails that have been processed
   * Used after digest processing to clean up inbox
   */
  async archiveOldEmails(): Promise<number> {
    const timer = createTimer(log, "archive-old-emails");

    // Query for AI emails older than 7 days that are still in inbox
    const query = "in:inbox older_than:7d";
    const messageIds = await this.listMessages(query, 500);
    log.info({ messageCount: messageIds.length }, "Checking old messages to archive");

    const aiMessageIds: string[] = [];

    // Check each message to see if it's AI-related
    for (const messageId of messageIds) {
      try {
        const message = await this.getMessageMetadata(messageId);
        const headers = message.payload?.headers || [];
        const subject = this.getHeaderValue(headers, "Subject");
        const sender = this.getHeaderValue(headers, "From");

        const isAI = await this.isAIRelated(subject, sender);
        if (isAI) {
          aiMessageIds.push(messageId);
        }
      } catch (_error) {
        log.debug({ messageId }, "Error checking message, skipping");
      }
    }

    if (aiMessageIds.length > 0) {
      await this.archiveMessages(aiMessageIds);
      log.info({ count: aiMessageIds.length }, "Archived old AI emails");
    }

    timer.end({
      totalMessages: messageIds.length,
      aiMessages: aiMessageIds.length,
    });
    return aiMessageIds.length;
  }

  /**
   * Find and process old AI emails for cleanup
   */
  async sweepOldAIEmails(): Promise<number> {
    const timer = createTimer(log, "sweep-old-emails");

    const query = `in:anywhere older_than:${config.olderThanDays}d`;
    const messageIds = await this.listMessages(query, 1000);
    log.info(
      { messageCount: messageIds.length, days: config.olderThanDays },
      "Checking old messages"
    );

    const aiMessageIds: string[] = [];

    // Check each message to see if it's AI-related
    for (const messageId of messageIds) {
      try {
        const message = await this.getMessageMetadata(messageId);
        const headers = message.payload?.headers || [];
        const subject = this.getHeaderValue(headers, "Subject");
        const sender = this.getHeaderValue(headers, "From");

        const isAI = await this.isAIRelated(subject, sender);
        if (isAI) {
          aiMessageIds.push(messageId);
        }
      } catch (_error) {
        log.debug({ messageId }, "Error checking message, skipping");
      }
    }

    if (aiMessageIds.length > 0) {
      await this.markReadAndArchive(aiMessageIds);
      log.info({ count: aiMessageIds.length }, "Marked old AI emails as read and archived");
    }

    timer.end({
      totalMessages: messageIds.length,
      aiMessages: aiMessageIds.length,
    });
    return aiMessageIds.length;
  }
}

// Export singleton instance
export const gmailClient = new GmailClient();
