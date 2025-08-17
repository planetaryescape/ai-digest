import type { DigestResult } from "../../core/digest-processor";

export class DigestResultBuilder {
  private result: Partial<DigestResult> = {};

  /**
   * Set success status
   */
  withSuccess(success: boolean): this {
    this.result.success = success;
    return this;
  }

  /**
   * Set the message
   */
  withMessage(message: string): this {
    this.result.message = message;
    return this;
  }

  /**
   * Set email counts
   */
  withEmailCounts(found: number, processed: number): this {
    this.result.emailsFound = found;
    this.result.emailsProcessed = processed;
    return this;
  }

  /**
   * Set error details
   */
  withError(error: string | Error): this {
    this.result.success = false;
    this.result.error = error instanceof Error ? error.message : error;
    return this;
  }

  /**
   * Set batch information for cleanup mode
   */
  withBatches(batches: number): this {
    this.result.batches = batches;
    return this;
  }

  /**
   * Set invocation ID
   */
  withInvocationId(id: string): this {
    this.result.invocationId = id;
    return this;
  }

  /**
   * Add metadata
   */
  withMetadata(key: string, value: any): this {
    if (!this.result.metadata) {
      this.result.metadata = {};
    }
    this.result.metadata[key] = value;
    return this;
  }

  /**
   * Set processing time
   */
  withProcessingTime(startTime: number): this {
    const duration = Date.now() - startTime;
    return this.withMetadata("processingTimeMs", duration);
  }

  /**
   * Mark as no emails found
   */
  noEmailsFound(): this {
    return this.withSuccess(true)
      .withMessage("No new AI-related emails found")
      .withEmailCounts(0, 0);
  }

  /**
   * Mark as successful with emails
   */
  successful(found: number, processed: number): this {
    return this.withSuccess(true)
      .withMessage(`Successfully processed ${processed} of ${found} emails`)
      .withEmailCounts(found, processed);
  }

  /**
   * Mark as failed
   */
  failed(error: Error | string, found = 0, processed = 0): this {
    return this.withSuccess(false)
      .withError(error)
      .withMessage(`Processing failed: ${error instanceof Error ? error.message : error}`)
      .withEmailCounts(found, processed);
  }

  /**
   * Build the final result
   */
  build(): DigestResult {
    // Set defaults
    this.result.success = this.result.success ?? false;
    this.result.emailsFound = this.result.emailsFound ?? 0;
    this.result.emailsProcessed = this.result.emailsProcessed ?? 0;
    this.result.message =
      this.result.message || (this.result.success ? "Processing completed" : "Processing failed");

    return this.result as DigestResult;
  }

  /**
   * Create a success result
   */
  static success(found: number, processed: number, message?: string): DigestResult {
    return new DigestResultBuilder()
      .successful(found, processed)
      .withMessage(message || `Processed ${processed} of ${found} emails`)
      .build();
  }

  /**
   * Create a failure result
   */
  static failure(error: Error | string, found = 0, processed = 0): DigestResult {
    return new DigestResultBuilder().failed(error, found, processed).build();
  }

  /**
   * Create a no-emails result
   */
  static noEmails(): DigestResult {
    return new DigestResultBuilder().noEmailsFound().build();
  }
}
