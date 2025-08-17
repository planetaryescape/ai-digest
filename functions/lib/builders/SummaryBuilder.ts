import { createLogger } from "../logger";
import type { DigestOutput, EmailItem, Summary } from "../types";

export class SummaryBuilder {
  private logger = createLogger("SummaryBuilder");
  private summary: Partial<Summary> = {};

  /**
   * Set the digest content
   */
  withDigest(digest: string | DigestOutput): this {
    this.summary.digest = digest;
    return this;
  }

  /**
   * Set the message
   */
  withMessage(message: string): this {
    this.summary.message = message;
    return this;
  }

  /**
   * Set the email items
   */
  withItems(items: EmailItem[]): this {
    this.summary.items = items;
    return this;
  }

  /**
   * Set the email count
   */
  withEmailCount(count: number): this {
    this.summary.emailCount = count;
    return this;
  }

  /**
   * Set the generated timestamp
   */
  withGeneratedAt(timestamp?: string): this {
    this.summary.generatedAt = timestamp || new Date().toISOString();
    return this;
  }

  /**
   * Set the time period
   */
  withPeriod(startDate: Date, endDate: Date): this {
    this.summary.periodStart = startDate.toISOString();
    this.summary.periodEnd = endDate.toISOString();
    return this;
  }

  /**
   * Add metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.summary.metadata = {
      ...this.summary.metadata,
      ...metadata,
    };
    return this;
  }

  /**
   * Set processing stats
   */
  withStats(stats: {
    totalEmails?: number;
    processedEmails?: number;
    skippedEmails?: number;
    errors?: number;
    processingTime?: number;
  }): this {
    this.summary.stats = {
      ...this.summary.stats,
      ...stats,
    };
    return this;
  }

  /**
   * Add tags for categorization
   */
  withTags(tags: string[]): this {
    this.summary.tags = tags;
    return this;
  }

  /**
   * Set the summary type
   */
  withType(type: "weekly" | "cleanup" | "custom"): this {
    this.summary.type = type;
    return this;
  }

  /**
   * Mark as sent
   */
  markAsSent(sentAt?: string): this {
    this.summary.sent = true;
    this.summary.sentAt = sentAt || new Date().toISOString();
    return this;
  }

  /**
   * Copy from existing summary
   */
  fromExisting(summary: Partial<Summary>): this {
    this.summary = { ...summary };
    return this;
  }

  /**
   * Validate the summary before building
   */
  private validate(): void {
    const errors: string[] = [];

    if (!this.summary.digest) {
      errors.push("Summary requires digest content");
    }

    if (!this.summary.items || this.summary.items.length === 0) {
      errors.push("Summary requires at least one email item");
    }

    if (!this.summary.generatedAt) {
      errors.push("Summary requires generation timestamp");
    }

    if (errors.length > 0) {
      throw new Error(`Summary validation failed: ${errors.join(", ")}`);
    }
  }

  /**
   * Build the final summary object
   */
  build(): Summary {
    // Set defaults
    this.summary.generatedAt = this.summary.generatedAt || new Date().toISOString();
    this.summary.type = this.summary.type || "weekly";
    this.summary.sent = this.summary.sent || false;
    this.summary.emailCount = this.summary.emailCount || this.summary.items?.length || 0;

    // Validate before building
    this.validate();

    this.logger.info("Built summary", {
      type: this.summary.type,
      emailCount: this.summary.emailCount,
      hasTags: !!this.summary.tags?.length,
    });

    return this.summary as Summary;
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.summary = {};
    return this;
  }

  /**
   * Create a summary for weekly digest
   */
  static createWeeklySummary(digest: DigestOutput, emails: EmailItem[], message?: string): Summary {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return new SummaryBuilder()
      .withDigest(digest)
      .withItems(emails)
      .withMessage(message || "Weekly AI digest generated successfully")
      .withType("weekly")
      .withPeriod(weekAgo, now)
      .withStats({
        totalEmails: emails.length,
        processedEmails: emails.length,
        processingTime: Date.now(),
      })
      .build();
  }

  /**
   * Create a summary for cleanup digest
   */
  static createCleanupSummary(
    digest: DigestOutput,
    emails: EmailItem[],
    batchNumber: number,
    totalBatches: number
  ): Summary {
    return new SummaryBuilder()
      .withDigest(digest)
      .withItems(emails)
      .withMessage(`Cleanup batch ${batchNumber}/${totalBatches} processed`)
      .withType("cleanup")
      .withMetadata({
        batchNumber,
        totalBatches,
        isLastBatch: batchNumber === totalBatches,
      })
      .withStats({
        totalEmails: emails.length,
        processedEmails: emails.length,
      })
      .build();
  }
}
