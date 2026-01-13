import type { IStorageClient } from "../interfaces/storage";
import type { EmailItem } from "../types";

export interface IEmailRepository {
  findUnprocessed(emails: EmailItem[]): Promise<EmailItem[]>;
  findUnprocessedFromIds(allEmailIds: string[]): Promise<string[]>;
  markAsProcessed(emails: EmailItem[]): Promise<void>;
  getProcessedCount(): Promise<number>;
  cleanupOldRecords(days: number): Promise<void>;
}

/**
 * Repository for email-related data operations
 * Provides a clean abstraction over storage implementation
 */
export class EmailRepository implements IEmailRepository {
  constructor(protected readonly storage: IStorageClient) {}

  /**
   * Find unprocessed emails from a list
   */
  async findUnprocessed(emails: EmailItem[]): Promise<EmailItem[]> {
    const processedIds = new Set(await this.storage.getAllProcessedIds());
    return emails.filter((email) => !processedIds.has(email.id));
  }

  /**
   * Find unprocessed email IDs from a list of IDs
   */
  async findUnprocessedFromIds(allEmailIds: string[]): Promise<string[]> {
    const processedIds = new Set(await this.storage.getAllProcessedIds());
    return allEmailIds.filter((id) => !processedIds.has(id));
  }

  /**
   * Mark emails as processed
   */
  async markAsProcessed(emails: EmailItem[]): Promise<void> {
    if (emails.length === 0) return;

    await this.storage.markMultipleProcessed(
      emails.map((email) => ({
        id: email.id,
        subject: email.subject,
      }))
    );
  }

  /**
   * Get count of processed emails
   */
  async getProcessedCount(): Promise<number> {
    const processedIds = await this.storage.getAllProcessedIds();
    return processedIds.length;
  }

  /**
   * Clean up old processed records
   */
  async cleanupOldRecords(days: number): Promise<void> {
    await this.storage.cleanupOldRecords(days);
  }
}

/**
 * Weekly-specific email repository
 */
export class WeeklyEmailRepository extends EmailRepository {
  /**
   * Find unprocessed emails for weekly digest
   */
  async findUnprocessedWeekly(emails: EmailItem[]): Promise<EmailItem[]> {
    const processedIds = await this.storage.getWeeklyProcessedIds();
    return emails.filter((email) => !processedIds.includes(email.id));
  }
}
