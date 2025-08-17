import type { EmailItem } from "../types";

export class EmailBuilder {
  private email: Partial<EmailItem> = {};

  /**
   * Set the email ID
   */
  withId(id: string): this {
    this.email.id = id;
    return this;
  }

  /**
   * Set the sender
   */
  withSender(sender: string): this {
    this.email.sender = sender;
    return this;
  }

  /**
   * Set the subject
   */
  withSubject(subject: string): this {
    this.email.subject = subject;
    return this;
  }

  /**
   * Set the date
   */
  withDate(date: string | Date): this {
    this.email.date = typeof date === "string" ? date : date.toISOString();
    return this;
  }

  /**
   * Set the email payload
   */
  withPayload(payload: {
    body?: string;
    snippet?: string;
    headers?: Record<string, string>;
    attachments?: any[];
  }): this {
    this.email.payload = payload;
    return this;
  }

  /**
   * Set just the body
   */
  withBody(body: string): this {
    if (!this.email.payload) {
      this.email.payload = {};
    }
    this.email.payload.body = body;
    return this;
  }

  /**
   * Set just the snippet
   */
  withSnippet(snippet: string): this {
    if (!this.email.payload) {
      this.email.payload = {};
    }
    this.email.payload.snippet = snippet;
    return this;
  }

  /**
   * Add headers
   */
  withHeaders(headers: Record<string, string>): this {
    if (!this.email.payload) {
      this.email.payload = {};
    }
    this.email.payload.headers = headers;
    return this;
  }

  /**
   * Add a single header
   */
  addHeader(key: string, value: string): this {
    if (!this.email.payload) {
      this.email.payload = {};
    }
    if (!this.email.payload.headers) {
      this.email.payload.headers = {};
    }
    this.email.payload.headers[key] = value;
    return this;
  }

  /**
   * Set the link (Gmail link)
   */
  withLink(link: string): this {
    this.email.link = link;
    return this;
  }

  /**
   * Add extracted URLs
   */
  withUrls(urls: string[]): this {
    this.email.urls = urls;
    return this;
  }

  /**
   * Add a single URL
   */
  addUrl(url: string): this {
    if (!this.email.urls) {
      this.email.urls = [];
    }
    this.email.urls.push(url);
    return this;
  }

  /**
   * Set the summary
   */
  withSummary(summary: string): this {
    this.email.summary = summary;
    return this;
  }

  /**
   * Mark as AI-related
   */
  markAsAI(isAI = true): this {
    this.email.isAI = isAI;
    return this;
  }

  /**
   * Mark as processed
   */
  markAsProcessed(processed = true): this {
    this.email.processed = processed;
    return this;
  }

  /**
   * Add metadata
   */
  withMetadata(metadata: Record<string, any>): this {
    this.email.metadata = {
      ...this.email.metadata,
      ...metadata,
    };
    return this;
  }

  /**
   * Copy from existing email
   */
  fromExisting(email: Partial<EmailItem>): this {
    this.email = { ...email };
    return this;
  }

  /**
   * Validate the email
   */
  private validate(): void {
    const errors: string[] = [];

    if (!this.email.id) {
      errors.push("Email requires an ID");
    }

    if (!this.email.sender) {
      errors.push("Email requires a sender");
    }

    if (!this.email.subject) {
      errors.push("Email requires a subject");
    }

    if (!this.email.date) {
      errors.push("Email requires a date");
    }

    if (errors.length > 0) {
      throw new Error(`Email validation failed: ${errors.join(", ")}`);
    }
  }

  /**
   * Build the final email object
   */
  build(): EmailItem {
    // Set defaults
    this.email.date = this.email.date || new Date().toISOString();
    this.email.isAI = this.email.isAI ?? false;
    this.email.processed = this.email.processed ?? false;

    // Validate
    this.validate();

    return this.email as EmailItem;
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.email = {};
    return this;
  }

  /**
   * Create a test email
   */
  static createTestEmail(id: string, subject: string, sender = "test@example.com"): EmailItem {
    return new EmailBuilder()
      .withId(id)
      .withSubject(subject)
      .withSender(sender)
      .withDate(new Date())
      .withBody("Test email body")
      .withSnippet("Test email snippet...")
      .build();
  }

  /**
   * Create an AI email
   */
  static createAIEmail(id: string, subject: string, sender: string, body: string): EmailItem {
    return new EmailBuilder()
      .withId(id)
      .withSubject(subject)
      .withSender(sender)
      .withDate(new Date())
      .withBody(body)
      .markAsAI(true)
      .build();
  }
}
