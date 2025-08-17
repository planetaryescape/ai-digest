import { createLogger } from "../logger";
import type { EmailItem } from "../types";
import type { CommandResult, IEmailCommand } from "./IEmailCommand";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class ValidateEmailCommand implements IEmailCommand<ValidationResult> {
  private logger = createLogger("ValidateEmailCommand");

  getName(): string {
    return "ValidateEmail";
  }

  canExecute(email: EmailItem): boolean {
    return email !== null && email !== undefined;
  }

  async execute(email: EmailItem): Promise<CommandResult<ValidationResult>> {
    try {
      const errors: ValidationError[] = [];

      // Validate required fields
      if (!email.id) {
        errors.push({ field: "id", message: "Email ID is required" });
      }

      if (!email.sender) {
        errors.push({ field: "sender", message: "Sender is required" });
      } else if (!this.isValidEmail(email.sender)) {
        errors.push({ field: "sender", message: "Invalid sender email format" });
      }

      if (!email.subject) {
        errors.push({ field: "subject", message: "Subject is required" });
      }

      if (!email.date) {
        errors.push({ field: "date", message: "Date is required" });
      } else if (!this.isValidDate(email.date)) {
        errors.push({ field: "date", message: "Invalid date format" });
      }

      // Validate payload if present
      if (email.payload) {
        if (!email.payload.body && !email.payload.snippet) {
          errors.push({ field: "payload", message: "Email must have body or snippet" });
        }
      }

      // Check for suspicious patterns
      if (this.isSuspiciousEmail(email)) {
        errors.push({ field: "content", message: "Email contains suspicious patterns" });
      }

      const valid = errors.length === 0;

      if (!valid) {
        this.logger.warn(`Email ${email.id} validation failed with ${errors.length} errors`);
      }

      return {
        success: true,
        data: {
          valid,
          errors,
        },
        metadata: {
          emailId: email.id,
          errorCount: errors.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to validate email ${email.id}`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to validate email",
      };
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidDate(date: string): boolean {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }

  private isSuspiciousEmail(email: EmailItem): boolean {
    const suspiciousPatterns = [
      /\bphishing\b/i,
      /\bscam\b/i,
      /\bclick here immediately\b/i,
      /\bact now\b/i,
      /\bverify your account\b/i,
      /\bsuspended account\b/i,
      /\bcongratulations you won\b/i,
    ];

    const textToCheck = `${email.subject} ${email.payload?.body || ""} ${email.payload?.snippet || ""}`;

    return suspiciousPatterns.some((pattern) => pattern.test(textToCheck));
  }
}
