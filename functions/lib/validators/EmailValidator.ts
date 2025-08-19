import type { EmailItem } from "../types";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";

export interface EmailValidationOptions {
  maxSubjectLength?: number;
  maxBodyLength?: number;
  requireLinks?: boolean;
  maxLinks?: number;
}

export class EmailValidator extends BaseValidator<EmailItem> {
  constructor(private options: EmailValidationOptions = {}) {
    super();
  }

  validate(email: EmailItem): ValidationResult {
    this.result = new ValidationResult();

    // Validate required fields
    this.validateRequired("id", email.id);
    this.validateRequired("from", email.from);
    this.validateRequired("subject", email.subject);
    this.validateRequired("date", email.date);

    // Validate email structure
    if (email.id) {
      this.validateString("id", email.id, 1);
    }

    if (email.from) {
      this.validateEmailAddress("from", email.from);
    }

    if (email.subject) {
      const maxLength = this.options.maxSubjectLength || 500;
      this.validateString("subject", email.subject, 1, maxLength);
    }

    if (email.snippet) {
      const maxLength = this.options.maxBodyLength || 10000;
      this.validateString("snippet", email.snippet, 0, maxLength);
    }

    if (email.body) {
      const maxLength = this.options.maxBodyLength || 50000;
      this.validateString("body", email.body, 0, maxLength);
    }

    // Validate date
    if (email.date) {
      this.validateDate("date", email.date);
    }

    // Validate links if present
    if (email.links) {
      const maxLinks = this.options.maxLinks || 100;
      this.validateArray("links", email.links, 0, maxLinks, (link: unknown, index: number) => {
        if (typeof link === "object" && link !== null && "url" in link) {
          return this.validateUrl(`links[${index}].url`, (link as any).url);
        }
        this.result.addError(`links[${index}]`, "must be a valid link object", link);
        return false;
      });
    } else if (this.options.requireLinks) {
      this.result.addError("links", "are required");
    }

    // Validate AI sender if present
    if (email.isAISender !== undefined) {
      if (typeof email.isAISender !== "boolean") {
        this.result.addError("isAISender", "must be a boolean", email.isAISender);
      }
    }

    // Validate labels if present
    if (email.labels) {
      this.validateArray("labels", email.labels, 0, 50, (label: unknown, index: number) => {
        if (typeof label !== "string") {
          this.result.addError(`labels[${index}]`, "must be a string", label);
          return false;
        }
        return true;
      });
    }

    return this.result;
  }

  private validateEmailAddress(field: string, value: string): boolean {
    // Basic email validation - can be more sophisticated
    if (!value.includes("<") || !value.includes(">")) {
      // Simple format: just email
      return this.validateEmail(field, value);
    }

    // Format: Name <email@example.com>
    const emailMatch = value.match(/<(.+?)>/);
    if (!emailMatch) {
      this.result.addError(field, "invalid email format", value);
      return false;
    }

    return this.validateEmail(field, emailMatch[1]);
  }

  private validateDate(field: string, value: string): boolean {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      this.result.addError(field, "must be a valid date", value);
      return false;
    }

    // Check if date is not too far in the future
    const futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + 1); // Allow 1 day in future for timezone issues
    if (date > futureLimit) {
      this.result.addError(field, "cannot be in the future", value);
      return false;
    }

    return true;
  }
}

export class BulkEmailValidator {
  private validator: EmailValidator;

  constructor(options: EmailValidationOptions = {}) {
    this.validator = new EmailValidator(options);
  }

  validate(emails: EmailItem[]): ValidationResult {
    const result = new ValidationResult();

    if (!Array.isArray(emails)) {
      result.addError("emails", "must be an array", emails);
      return result;
    }

    emails.forEach((email, index) => {
      const emailResult = this.validator.validate(email);
      if (!emailResult.isValid) {
        emailResult.errorDetails.forEach((error) => {
          result.addError(`emails[${index}].${error.field}`, error.message, error.value);
        });
      }
    });

    return result;
  }

  validateWithFiltering(emails: EmailItem[]): {
    valid: EmailItem[];
    invalid: Array<{ email: EmailItem; errors: string[] }>;
  } {
    const valid: EmailItem[] = [];
    const invalid: Array<{ email: EmailItem; errors: string[] }> = [];

    emails.forEach((email) => {
      const result = this.validator.validate(email);
      if (result.isValid) {
        valid.push(email);
      } else {
        invalid.push({
          email,
          errors: result.errorMessages,
        });
      }
    });

    return { valid, invalid };
  }
}
