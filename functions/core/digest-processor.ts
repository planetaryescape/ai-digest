import { BATCH_LIMITS, RETENTION } from "../lib/constants";
import { sendDigest, sendErrorNotification } from "../lib/email";
import { gmailClient } from "../lib/gmail";
import type { ILogger } from "../lib/interfaces/logger";
import type { IStorageClient } from "../lib/interfaces/storage";
import { metrics } from "../lib/metrics";
import { EmailRepository } from "../lib/repositories/EmailRepository";
import { summarize } from "../lib/summarizer";
import type { EmailItem } from "../lib/types";
import { type Result, ResultUtils } from "../lib/types/Result";

export interface DigestProcessorOptions {
  storage: IStorageClient;
  logger: ILogger;
}

export interface DigestResult {
  success: boolean;
  emailsFound: number;
  emailsProcessed: number;
  message: string;
  error?: string;
  batches?: number;
}

/**
 * Core digest processing logic - cloud agnostic
 */
export class DigestProcessor {
  private storage: IStorageClient;
  private logger: ILogger;
  private emailRepository: EmailRepository;

  constructor(options: DigestProcessorOptions) {
    this.storage = options.storage;
    this.logger = options.logger;
    this.emailRepository = new EmailRepository(this.storage);
  }

  /**
   * Process emails in batches to avoid rate limits
   */
  private async processBatch(
    emails: EmailItem[],
    batchNumber: number,
    totalBatches: number
  ): Promise<void> {
    this.logger.info(
      `Processing batch ${batchNumber}/${totalBatches} with ${emails.length} emails`
    );

    // Track cleanup batch metrics
    if (totalBatches > 1) {
      metrics.cleanupMode(batchNumber, emails.length);
    }

    // Generate summary for this batch with timing
    const startTime = Date.now();
    const summary = await metrics.apiCall("openai", "summarize", () => summarize(emails));

    // Send digest for this batch with timing
    await metrics.apiCall("resend", "sendDigest", () => sendDigest(summary));

    // Track digest generation metrics
    const duration = Date.now() - startTime;
    metrics.digestGenerated(emails.length, duration);

    // Save confirmed AI senders
    try {
      const senderTracker = gmailClient.getSenderTracker();
      const sendersToSave = emails.map((email) => ({
        email: email.sender,
        name: email.sender,
      }));

      if (sendersToSave.length > 0) {
        await senderTracker.addMultipleConfirmedSenders(sendersToSave);
        this.logger.info(
          `Saved ${sendersToSave.length} confirmed AI senders from batch ${batchNumber}`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to save senders for batch ${batchNumber}`, error);
    }

    // Mark emails as processed with timing
    await metrics.storageOperation("markMultipleProcessed", () =>
      this.storage.markMultipleProcessed(emails.map((e) => ({ id: e.id, subject: e.subject })))
    );

    // Track emails processed
    metrics.emailsProcessed(emails.length, { batch: batchNumber.toString() });

    this.logger.info(`Completed batch ${batchNumber}/${totalBatches}`);
  }

  /**
   * Fetch all AI emails and filter unprocessed ones
   */
  private async fetchUnprocessedEmails(): Promise<{
    allEmails: EmailItem[];
    unprocessedEmails: EmailItem[];
  }> {
    // Fetch ALL AI emails from Gmail inbox with timing
    this.logger.info("Fetching ALL AI-related emails from Gmail inbox...");
    const allEmails = await metrics.apiCall("gmail", "getAllAIEmails", () =>
      gmailClient.getAllAIEmails()
    );
    this.logger.info(`Found ${allEmails.length} total AI-related emails in inbox`);

    // Filter out already processed emails with timing
    const processedIds = new Set(
      await metrics.storageOperation("getAllProcessedIds", () => this.storage.getAllProcessedIds())
    );
    const unprocessedEmails = allEmails.filter((email) => !processedIds.has(email.id));
    this.logger.info(`${unprocessedEmails.length} unprocessed emails to process in cleanup mode`);

    return { allEmails, unprocessedEmails };
  }

  /**
   * Process emails in batches with delays to avoid rate limits
   */
  private async processEmailBatches(
    emails: EmailItem[],
    batchSize: number,
    delayMs: number
  ): Promise<{ processedCount: number; batchCount: number }> {
    let processedCount = 0;
    let batchCount = 0;
    const totalBatches = Math.ceil(emails.length / batchSize);

    this.logger.info(
      `Processing ${emails.length} emails in ${totalBatches} batches of ${batchSize}`
    );

    for (let i = 0; i < emails.length; i += batchSize) {
      batchCount++;
      const batch = emails.slice(i, i + batchSize);

      try {
        await this.processBatch(batch, batchCount, totalBatches);
        processedCount += batch.length;

        // Delay between batches to avoid rate limits (except for last batch)
        if (i + batchSize < emails.length) {
          this.logger.info(`Waiting ${delayMs}ms before next batch...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (batchError) {
        this.logger.error(`Failed to process batch ${batchCount}`, batchError);
        // Continue with next batch even if one fails
      }
    }

    return { processedCount, batchCount };
  }

  /**
   * Perform post-processing tasks: archive emails and cleanup old records
   */
  private async performPostProcessingTasks(processedEmails: EmailItem[]): Promise<void> {
    // Archive all old AI emails
    try {
      this.logger.info("Archiving all old AI emails...");
      const archivedCount = await gmailClient.archiveOldEmails();
      this.logger.info(`Archived ${archivedCount} old AI emails`);

      // Also archive the emails we just processed
      const processedMessageIds = processedEmails.map((e) => e.id);
      if (processedMessageIds.length > 0) {
        await gmailClient.archiveMessages(processedMessageIds);
        this.logger.info(`Archived ${processedMessageIds.length} processed emails`);
      }
    } catch (archiveError) {
      this.logger.error("Failed to archive emails (non-critical)", archiveError);
    }

    // Cleanup old records
    try {
      const cleaned = await this.storage.cleanupOldRecords(RETENTION.PROCESSED_EMAILS_DAYS);
      if (cleaned > 0) {
        this.logger.info(`Cleaned up ${cleaned} old processed records`);
      }
    } catch (cleanupError) {
      this.logger.error("Failed to cleanup old records (non-critical)", cleanupError);
    }
  }

  /**
   * Process ALL unarchived AI emails in cleanup mode
   */
  async processCleanupDigest(): Promise<DigestResult> {
    this.logger.info("Cleanup digest processing started");

    let allEmails: EmailItem[] = [];
    let processedCount = 0;
    let batchCount = 0;

    try {
      // Step 1: Fetch and filter unprocessed emails
      const { allEmails: fetchedEmails, unprocessedEmails } = await this.fetchUnprocessedEmails();
      allEmails = fetchedEmails;

      // Guard: No emails found
      if (allEmails.length === 0) {
        this.logger.info("No AI-related emails found in inbox");
        return {
          success: true,
          emailsFound: 0,
          emailsProcessed: 0,
          message: "No AI-related emails found in inbox",
        };
      }

      // Guard: All emails already processed
      if (unprocessedEmails.length === 0) {
        this.logger.info("All emails have already been processed");

        // Archive old emails since everything is processed
        try {
          const archivedCount = await gmailClient.archiveOldEmails();
          this.logger.info(`Archived ${archivedCount} old AI emails`);
        } catch (archiveError) {
          this.logger.error("Failed to archive old emails", archiveError);
        }

        return {
          success: true,
          emailsFound: allEmails.length,
          emailsProcessed: 0,
          message: "All emails have already been processed",
        };
      }

      // Step 2: Process emails in batches
      const batchResult = await this.processEmailBatches(
        unprocessedEmails,
        BATCH_LIMITS.CLEANUP_BATCH_SIZE,
        BATCH_LIMITS.BATCH_DELAY_MS
      );
      processedCount = batchResult.processedCount;
      batchCount = batchResult.batchCount;

      // Step 3: Perform post-processing tasks
      await this.performPostProcessingTasks(unprocessedEmails.slice(0, processedCount));

      this.logger.info(
        `✅ Cleanup digest completed: processed ${processedCount} emails in ${batchCount} batches`
      );

      return {
        success: true,
        emailsFound: allEmails.length,
        emailsProcessed: processedCount,
        batches: batchCount,
        message: `Successfully processed ${processedCount} AI emails in ${batchCount} batches`,
      };
    } catch (error) {
      this.logger.error("❌ Failed to process cleanup digest", error);

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      return {
        success: false,
        emailsFound: allEmails.length,
        emailsProcessed: processedCount,
        batches: batchCount,
        message: `Cleanup failed after processing ${processedCount} emails in ${batchCount} batches`,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate and fetch weekly AI emails using Result pattern
   */
  private async validateAndFetchEmails(): Promise<
    Result<{
      allEmails: EmailItem[];
      unprocessedEmails: EmailItem[];
    }>
  > {
    // Fetch emails from Gmail
    this.logger.info("Fetching AI-related emails from Gmail...");

    const emailsResult = await ResultUtils.try(() => gmailClient.getWeeklyAIEmails());
    if (!emailsResult.ok) {
      return emailsResult;
    }

    const allEmails = emailsResult.value;
    this.logger.info(`Found ${allEmails.length} AI-related emails`);

    // Guard: No emails found
    if (allEmails.length === 0) {
      this.logger.info(
        "No AI-related emails found to process. Exiting without further processing."
      );
      return ResultUtils.ok({ allEmails: [], unprocessedEmails: [] });
    }

    // Filter out already processed emails using repository
    const processedIds = await this.storage.getWeeklyProcessedIds();
    const unprocessedEmails = allEmails.filter((email) => !processedIds.includes(email.id));
    this.logger.info(`${unprocessedEmails.length} unprocessed emails to summarize`);

    return ResultUtils.ok({ allEmails, unprocessedEmails });
  }

  /**
   * Generate summary and send digest email using Result pattern
   */
  private async generateAndSendDigest(emails: EmailItem[]): Promise<Result<boolean>> {
    // Generate summary
    this.logger.info("Generating AI digest...");
    const summaryResult = await ResultUtils.try(() => summarize(emails));
    if (!summaryResult.ok) {
      return summaryResult;
    }

    const summary = summaryResult.value;
    this.logger.info(`Generated summary for ${summary.items.length} items`);

    // Send digest email
    this.logger.info("Sending digest email...");
    const sendResult = await ResultUtils.try(() => sendDigest(summary));
    if (!sendResult.ok) {
      return ResultUtils.err(sendResult.error);
    }
    this.logger.info("✅ Digest email sent successfully");

    // Save confirmed AI senders for future detection
    try {
      this.logger.info("Saving confirmed AI senders...");
      const senderTracker = gmailClient.getSenderTracker();
      const sendersToSave = emails.map((email) => ({
        email: email.sender,
        name: email.sender,
      }));

      if (sendersToSave.length > 0) {
        await senderTracker.addMultipleConfirmedSenders(sendersToSave);
        this.logger.info(`✅ Saved ${sendersToSave.length} confirmed AI senders`);
      }
    } catch (error) {
      // Non-critical error
      this.logger.error("Failed to save confirmed senders (non-critical)", error);
    }

    // Mark emails as processed using repository
    if (emails.length > 0) {
      await this.emailRepository.markAsProcessed(emails);
      this.logger.info(`✅ Marked ${emails.length} emails as processed`);
    }

    return ResultUtils.ok(true);
  }

  /**
   * Perform cleanup tasks after successful weekly digest
   */
  private async performWeeklyCleanupTasks(emails: EmailItem[]): Promise<void> {
    try {
      this.logger.info("Archiving old emails...");
      const archivedCount = await gmailClient.archiveOldEmails();
      this.logger.info(`✅ Archived ${archivedCount} old emails`);

      // Verify emails were actually processed before we archived
      const verifyProcessed = await Promise.all(
        emails.slice(0, 3).map((e) => this.storage.isProcessed(e.id))
      );
      if (!verifyProcessed.every((v) => v)) {
        this.logger.warn("⚠️ Some emails may not have been properly marked as processed!");
      }
    } catch (archiveError) {
      // Archive errors are non-critical
      this.logger.error("⚠️ Failed to archive old emails (non-critical)", archiveError);
    }

    // Cleanup old processed records
    try {
      const cleaned = await this.storage.cleanupOldRecords(RETENTION.PROCESSED_EMAILS_DAYS);
      if (cleaned > 0) {
        this.logger.info(`🧹 Cleaned up ${cleaned} old processed records`);
      }
    } catch (cleanupError) {
      // Cleanup errors are non-critical
      this.logger.error("⚠️ Failed to cleanup old records (non-critical)", cleanupError);
    }
  }

  /**
   * Process the weekly digest
   */
  async processWeeklyDigest(): Promise<DigestResult> {
    this.logger.info("Weekly digest processing started");

    let unprocessedEmails: EmailItem[] = [];
    let allEmails: EmailItem[] = [];

    try {
      // Step 1: Validate and fetch emails
      const emailDataResult = await this.validateAndFetchEmails();

      if (!emailDataResult.ok) {
        throw emailDataResult.error;
      }

      const emailData = emailDataResult.value;
      allEmails = emailData.allEmails;
      unprocessedEmails = emailData.unprocessedEmails;

      if (allEmails.length === 0) {
        return {
          success: true,
          emailsFound: 0,
          emailsProcessed: 0,
          message: "No AI-related emails found to process",
        };
      }

      if (unprocessedEmails.length === 0) {
        return {
          success: true,
          emailsFound: allEmails.length,
          emailsProcessed: 0,
          message: "All emails have already been processed",
        };
      }

      // Step 2: Generate and send digest
      const digestResult = await this.generateAndSendDigest(unprocessedEmails);

      if (!digestResult.ok) {
        throw digestResult.error;
      }

      // Step 3: Perform cleanup tasks (optional, only if everything succeeded)
      if (digestResult.value && unprocessedEmails.length > 0) {
        await this.performWeeklyCleanupTasks(unprocessedEmails);
      } else {
        this.logger.info("Skipping cleanup tasks - email not sent or no emails processed");
      }

      this.logger.info("✅ Weekly digest completed successfully");

      return {
        success: true,
        emailsFound: allEmails.length,
        emailsProcessed: unprocessedEmails.length,
        message: `Successfully processed ${unprocessedEmails.length} AI emails and sent digest`,
      };
    } catch (error) {
      this.logger.error("❌ Failed to process weekly digest", error);

      // Send error notification with details
      try {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const errorDetails = `
Weekly Digest Processing Failed

Error: ${errorMessage}
Time: ${new Date().toISOString()}
Emails found: ${allEmails.length}
Unprocessed emails: ${unprocessedEmails.length}
        `.trim();

        await sendErrorNotification(new Error(errorDetails));
        this.logger.info("Error notification sent");
      } catch (notifyError) {
        this.logger.error("Failed to send error notification", notifyError);
      }

      const errorMessage =
        error instanceof Error ? error.message : "An error occurred processing the digest";
      const isCriticalError =
        errorMessage.includes("Email send failed") ||
        errorMessage.includes("Summary generation failed");

      return {
        success: false,
        emailsFound: allEmails.length,
        emailsProcessed: 0,
        message: isCriticalError
          ? "Critical error: Emails were NOT processed to prevent data loss"
          : "Non-critical error: Emails remain safe",
        error: errorMessage,
      };
    }
  }
}
