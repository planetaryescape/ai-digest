import { createLogger } from "../logger";
import type { EmailItem } from "../types";
import type { CommandResult, IEmailCommand } from "./IEmailCommand";

export class ExtractUrlsCommand implements IEmailCommand<string[]> {
  private logger = createLogger("ExtractUrlsCommand");

  getName(): string {
    return "ExtractUrls";
  }

  canExecute(email: EmailItem): boolean {
    return !!(email.payload && (email.payload.body || email.payload.snippet));
  }

  async execute(email: EmailItem): Promise<CommandResult<string[]>> {
    try {
      if (!this.canExecute(email)) {
        return {
          success: false,
          error: "Email has no content to extract URLs from",
        };
      }

      const urls = this.extractUrls(email.payload);

      this.logger.info(`Extracted ${urls.length} URLs from email ${email.id}`);

      return {
        success: true,
        data: urls,
        metadata: {
          emailId: email.id,
          urlCount: urls.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to extract URLs from email ${email.id}`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract URLs",
      };
    }
  }

  private extractUrls(payload: any): string[] {
    const urlPattern =
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;
    const text = `${payload.body || ""} ${payload.snippet || ""}`;
    const matches = text.match(urlPattern) || [];

    // Remove duplicates and filter out common tracking/unsubscribe URLs
    const uniqueUrls = [...new Set(matches)];

    return uniqueUrls.filter((url) => {
      const lowerUrl = url.toLowerCase();
      return (
        !lowerUrl.includes("unsubscribe") &&
        !lowerUrl.includes("tracking") &&
        !lowerUrl.includes("list-manage") &&
        !lowerUrl.includes("click.convertkit") &&
        !lowerUrl.includes("email.mg")
      );
    });
  }
}
