import { RATE_LIMITS } from "../constants";
import type { CostTracker } from "../cost-tracker";
import { createLogger } from "../logger";

const log = createLogger("ContentExtractorAgent");

export class ContentExtractorAgent {
  private stats = {
    articlesExtracted: 0,
    apiCallsMade: 0,
    errors: 0,
  };

  constructor(_costTracker: CostTracker) {}

  async extractArticles(emails: any[]): Promise<any[]> {
    log.info({ count: emails.length }, "Starting article extraction");

    const enrichedEmails = [];

    for (const email of emails) {
      try {
        // Extract URLs from email content
        const urls = this.extractUrls(email.body || email.snippet || "");

        // For now, just add the URLs to the email
        // In production, this would use Firecrawl to extract content
        const enrichedEmail = {
          ...email,
          extractedUrls: urls.slice(0, RATE_LIMITS.MAX_URLS_PER_EMAIL),
          articleContent: urls.length > 0 ? "Article content would be extracted here" : null,
        };

        enrichedEmails.push(enrichedEmail);
        this.stats.articlesExtracted += urls.length;
      } catch (error) {
        this.stats.errors++;
        log.error({ error, emailId: email.id }, "Article extraction failed");
        enrichedEmails.push(email);
      }
    }

    log.info(
      {
        processed: enrichedEmails.length,
        articlesExtracted: this.stats.articlesExtracted,
      },
      "Article extraction complete"
    );

    return enrichedEmails;
  }

  private extractUrls(text: string): string[] {
    const urlRegex =
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  getStats() {
    return { ...this.stats };
  }
}
