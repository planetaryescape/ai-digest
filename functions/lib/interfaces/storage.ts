import type { ProcessedEmail } from "../types";

/**
 * Cloud-agnostic storage interface
 */
export interface IStorageClient {
  /**
   * Mark an email as processed
   */
  markProcessed(emailId: string, subject: string): Promise<void>;

  /**
   * Mark multiple emails as processed
   */
  markMultipleProcessed(emails: Array<{ id: string; subject: string }>): Promise<void>;

  /**
   * Get list of processed email IDs from the last week
   */
  getWeeklyProcessedIds(): Promise<string[]>;

  /**
   * Get all processed emails
   */
  getAllProcessed(): Promise<ProcessedEmail[]>;

  /**
   * Get all processed email IDs
   */
  getAllProcessedIds(): Promise<string[]>;

  /**
   * Check if an email has been processed
   */
  isProcessed(emailId: string): Promise<boolean>;

  /**
   * Delete old processed records
   */
  cleanupOldRecords(daysToKeep: number): Promise<number>;
}
