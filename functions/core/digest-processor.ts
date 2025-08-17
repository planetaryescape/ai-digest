import { sendDigest, sendErrorNotification } from "../lib/email";
import { gmailClient } from "../lib/gmail";
import { summarize } from "../lib/summarizer";
import type { EmailItem } from "../lib/types";
import type { IStorageClient } from "../lib/interfaces/storage";
import type { ILogger } from "../lib/interfaces/logger";

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

  constructor(options: DigestProcessorOptions) {
    this.storage = options.storage;
    this.logger = options.logger;
  }

  /**
   * Process emails in batches to avoid rate limits
   */
  private async processBatch(emails: EmailItem[], batchNumber: number, totalBatches: number): Promise<void> {
    this.logger.info(`Processing batch ${batchNumber}/${totalBatches} with ${emails.length} emails`);
    
    // Generate summary for this batch
    const summary = await summarize(emails);
    
    // Send digest for this batch
    await sendDigest(summary);
    
    // Save confirmed AI senders
    try {
      const senderTracker = gmailClient.getSenderTracker();
      const sendersToSave = emails.map(email => ({
        email: email.sender,
        name: email.sender,
      }));
      
      if (sendersToSave.length > 0) {
        await senderTracker.addMultipleConfirmedSenders(sendersToSave);
        this.logger.info(`Saved ${sendersToSave.length} confirmed AI senders from batch ${batchNumber}`);
      }
    } catch (error) {
      this.logger.error(`Failed to save senders for batch ${batchNumber}`, error);
    }
    
    // Mark emails as processed
    await this.storage.markMultipleProcessed(
      emails.map(e => ({ id: e.id, subject: e.subject }))
    );
    
    this.logger.info(`Completed batch ${batchNumber}/${totalBatches}`);
  }

  /**
   * Process ALL unarchived AI emails in cleanup mode
   */
  async processCleanupDigest(): Promise<DigestResult> {
    this.logger.info("Cleanup digest processing started");
    
    const BATCH_SIZE = 50; // Process 50 emails per batch to avoid context limits
    const BATCH_DELAY_MS = 5000; // 5 second delay between batches to avoid rate limits
    
    let allEmails: EmailItem[] = [];
    let processedCount = 0;
    let batchCount = 0;

    try {
      // Step 1: Fetch ALL AI emails from Gmail inbox
      this.logger.info("Fetching ALL AI-related emails from Gmail inbox...");
      allEmails = await gmailClient.getAllAIEmails();
      this.logger.info(`Found ${allEmails.length} total AI-related emails in inbox`);

      // Guard: No emails found
      if (allEmails.length === 0) {
        this.logger.info("No AI-related emails found in inbox");
        return {
          success: true,
          emailsFound: 0,
          emailsProcessed: 0,
          message: "No AI-related emails found in inbox"
        };
      }

      // Step 2: Filter out already processed emails
      const processedIds = new Set(await this.storage.getAllProcessedIds());
      const unprocessedEmails = allEmails.filter(email => !processedIds.has(email.id));
      this.logger.info(`${unprocessedEmails.length} unprocessed emails to process in cleanup mode`);

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
          message: "All emails have already been processed"
        };
      }

      // Step 3: Process emails in batches
      const totalBatches = Math.ceil(unprocessedEmails.length / BATCH_SIZE);
      this.logger.info(`Processing ${unprocessedEmails.length} emails in ${totalBatches} batches of ${BATCH_SIZE}`);

      for (let i = 0; i < unprocessedEmails.length; i += BATCH_SIZE) {
        batchCount++;
        const batch = unprocessedEmails.slice(i, i + BATCH_SIZE);
        
        try {
          await this.processBatch(batch, batchCount, totalBatches);
          processedCount += batch.length;
          
          // Delay between batches to avoid rate limits (except for last batch)
          if (i + BATCH_SIZE < unprocessedEmails.length) {
            this.logger.info(`Waiting ${BATCH_DELAY_MS}ms before next batch...`);
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
          }
        } catch (batchError) {
          this.logger.error(`Failed to process batch ${batchCount}`, batchError);
          // Continue with next batch even if one fails
        }
      }

      // Step 4: Archive all old AI emails after processing
      try {
        this.logger.info("Archiving all old AI emails...");
        const archivedCount = await gmailClient.archiveOldEmails();
        this.logger.info(`Archived ${archivedCount} old AI emails`);
        
        // Also archive the emails we just processed
        const processedMessageIds = unprocessedEmails.slice(0, processedCount).map(e => e.id);
        if (processedMessageIds.length > 0) {
          await gmailClient.archiveMessages(processedMessageIds);
          this.logger.info(`Archived ${processedMessageIds.length} processed emails`);
        }
      } catch (archiveError) {
        this.logger.error("Failed to archive emails (non-critical)", archiveError);
      }

      // Step 5: Cleanup old records
      try {
        const cleaned = await this.storage.cleanupOldRecords(90);
        if (cleaned > 0) {
          this.logger.info(`Cleaned up ${cleaned} old processed records`);
        }
      } catch (cleanupError) {
        this.logger.error("Failed to cleanup old records (non-critical)", cleanupError);
      }

      this.logger.info(`✅ Cleanup digest completed: processed ${processedCount} emails in ${batchCount} batches`);
      
      return {
        success: true,
        emailsFound: allEmails.length,
        emailsProcessed: processedCount,
        batches: batchCount,
        message: `Successfully processed ${processedCount} AI emails in ${batchCount} batches`
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
        error: errorMessage
      };
    }
  }

  /**
   * Process the weekly digest
   */
  async processWeeklyDigest(): Promise<DigestResult> {
    this.logger.info("Weekly digest processing started");
    
    let emailsSentSuccessfully = false;
    let unprocessedEmails: EmailItem[] = [];
    let allEmails: EmailItem[] = [];

    try {
      // Step 1: Fetch emails from Gmail
      this.logger.info("Fetching AI-related emails from Gmail...");
      allEmails = await gmailClient.getWeeklyAIEmails();
      this.logger.info(`Found ${allEmails.length} AI-related emails`);

      // Guard: No emails found - exit early
      if (allEmails.length === 0) {
        this.logger.info("No AI-related emails found to process. Exiting without further processing.");
        return {
          success: true,
          emailsFound: 0,
          emailsProcessed: 0,
          message: "No AI-related emails found to process"
        };
      }

      // Step 2: Filter out already processed emails
      const processedIds = await this.storage.getWeeklyProcessedIds();
      unprocessedEmails = allEmails.filter(email => !processedIds.includes(email.id));
      this.logger.info(`${unprocessedEmails.length} unprocessed emails to summarize`);

      // Guard: All emails already processed - exit early
      if (unprocessedEmails.length === 0) {
        this.logger.info("All emails have already been processed. Exiting without further processing.");
        return {
          success: true,
          emailsFound: allEmails.length,
          emailsProcessed: 0,
          message: "All emails have already been processed"
        };
      }

      // Step 3: Generate summary
      this.logger.info("Generating AI digest...");
      const summary = await summarize(unprocessedEmails);
      this.logger.info(`Generated summary for ${summary.items.length} items`);

      // Step 4: Send digest email
      this.logger.info("Sending digest email...");
      await sendDigest(summary);
      emailsSentSuccessfully = true;
      this.logger.info("✅ Digest email sent successfully");
      
      // Step 4b: Save confirmed AI senders for future detection
      try {
        this.logger.info("Saving confirmed AI senders...");
        const senderTracker = gmailClient.getSenderTracker();
        const sendersToSave = unprocessedEmails.map(email => ({
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

      // Step 5: Mark emails as processed only if email was sent successfully
      if (emailsSentSuccessfully && unprocessedEmails.length > 0) {
        await this.storage.markMultipleProcessed(
          unprocessedEmails.map(e => ({ id: e.id, subject: e.subject }))
        );
        this.logger.info(`✅ Marked ${unprocessedEmails.length} emails as processed`);
      } else {
        this.logger.info("Skipping marking emails as processed - email not sent or no emails to process");
      }

      // Step 6: Archive old emails (optional, only if everything succeeded)
      if (emailsSentSuccessfully && unprocessedEmails.length > 0) {
        try {
          this.logger.info("Archiving old emails...");
          const archivedCount = await gmailClient.archiveOldEmails();
          this.logger.info(`✅ Archived ${archivedCount} old emails`);
          
          // Verify emails were actually processed before we archived
          const verifyProcessed = await Promise.all(
            unprocessedEmails.slice(0, 3).map(e => this.storage.isProcessed(e.id))
          );
          if (!verifyProcessed.every(v => v)) {
            this.logger.warn("⚠️ Some emails may not have been properly marked as processed!");
          }
        } catch (archiveError) {
          // Archive errors are non-critical
          this.logger.error("⚠️ Failed to archive old emails (non-critical)", archiveError);
        }
        
        // Cleanup old processed records
        try {
          const cleaned = await this.storage.cleanupOldRecords(90);
          if (cleaned > 0) {
            this.logger.info(`🧹 Cleaned up ${cleaned} old processed records`);
          }
        } catch (cleanupError) {
          // Cleanup errors are non-critical
          this.logger.error("⚠️ Failed to cleanup old records (non-critical)", cleanupError);
        }
      } else {
        this.logger.info("Skipping archive step - email not sent or no emails processed");
      }

      this.logger.info("✅ Weekly digest completed successfully");
      
      return {
        success: true,
        emailsFound: allEmails.length,
        emailsProcessed: unprocessedEmails.length,
        message: `Successfully processed ${unprocessedEmails.length} AI emails and sent digest`
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
      
      const errorMessage = error instanceof Error ? error.message : "An error occurred processing the digest";
      const isCriticalError = errorMessage.includes("Email send failed") || 
                             errorMessage.includes("Summary generation failed");
      
      return {
        success: false,
        emailsFound: allEmails.length,
        emailsProcessed: 0,
        message: isCriticalError 
          ? "Critical error: Emails were NOT processed to prevent data loss"
          : "Non-critical error: Emails remain safe",
        error: errorMessage
      };
    }
  }
}