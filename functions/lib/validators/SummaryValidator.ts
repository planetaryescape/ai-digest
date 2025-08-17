import type { Summary, SummaryItem } from "../types";
import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";

export class SummaryItemValidator extends BaseValidator<SummaryItem> {
  validate(item: SummaryItem): ValidationResult {
    this.result = new ValidationResult();

    // Validate required fields
    this.validateRequired("title", item.title);
    this.validateRequired("summary", item.summary);
    this.validateRequired("source", item.source);

    // Validate string fields
    if (item.title) {
      this.validateString("title", item.title, 1, 500);
    }

    if (item.summary) {
      this.validateString("summary", item.summary, 10, 5000);
    }

    if (item.source) {
      this.validateString("source", item.source, 1, 200);
    }

    // Validate optional fields
    if (item.url !== undefined) {
      this.validateUrl("url", item.url);
    }

    if (item.date !== undefined) {
      this.validateDate("date", item.date);
    }

    if (item.importance !== undefined) {
      this.validateEnum("importance", item.importance, ["low", "medium", "high", "critical"]);
    }

    if (item.category !== undefined) {
      this.validateString("category", item.category, 1, 100);
    }

    if (item.keyPoints !== undefined) {
      this.validateArray("keyPoints", item.keyPoints, 0, 10, (point: unknown, index: number) => {
        if (typeof point !== "string" || point.trim().length === 0) {
          this.result.addError(`keyPoints[${index}]`, "must be a non-empty string", point);
          return false;
        }
        if (point.length > 500) {
          this.result.addError(`keyPoints[${index}]`, "must be at most 500 characters", point);
          return false;
        }
        return true;
      });
    }

    if (item.tags !== undefined) {
      this.validateArray("tags", item.tags, 0, 20, (tag: unknown, index: number) => {
        if (typeof tag !== "string" || tag.trim().length === 0) {
          this.result.addError(`tags[${index}]`, "must be a non-empty string", tag);
          return false;
        }
        if (tag.length > 50) {
          this.result.addError(`tags[${index}]`, "must be at most 50 characters", tag);
          return false;
        }
        return true;
      });
    }

    if (item.sentiment !== undefined) {
      this.validateEnum("sentiment", item.sentiment, ["positive", "neutral", "negative", "mixed"]);
    }

    return this.result;
  }

  private validateDate(field: string, value: unknown): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      this.result.addError(field, "must be a valid date", value);
      return false;
    }

    return true;
  }
}

export class SummaryValidator extends BaseValidator<Summary> {
  private itemValidator: SummaryItemValidator;

  constructor() {
    super();
    this.itemValidator = new SummaryItemValidator();
  }

  validate(summary: Summary): ValidationResult {
    this.result = new ValidationResult();

    // Validate required fields
    this.validateRequired("items", summary.items);

    // Validate items array
    if (summary.items) {
      this.validateArray("items", summary.items, 1, 100, (item: unknown, index: number) => {
        if (typeof item !== "object" || item === null) {
          this.result.addError(`items[${index}]`, "must be an object", item);
          return false;
        }

        const itemResult = this.itemValidator.validate(item as SummaryItem);
        if (!itemResult.isValid) {
          itemResult.errorDetails.forEach((error) => {
            this.result.addError(`items[${index}].${error.field}`, error.message, error.value);
          });
          return false;
        }

        return true;
      });
    }

    // Validate professional advice
    if (summary.professionalAdvice !== undefined) {
      this.validateProfessionalAdvice(summary.professionalAdvice);
    }

    // Validate product plays
    if (summary.productPlays !== undefined) {
      this.validateProductPlays(summary.productPlays);
    }

    // Validate metadata
    if (summary.metadata !== undefined) {
      this.validateMetadata(summary.metadata);
    }

    // Validate overall sentiment
    if (summary.overallSentiment !== undefined) {
      this.validateEnum(
        "overallSentiment",
        summary.overallSentiment,
        ["positive", "neutral", "negative", "mixed"]
      );
    }

    // Validate key themes
    if (summary.keyThemes !== undefined) {
      this.validateArray("keyThemes", summary.keyThemes, 0, 20, (theme: unknown, index: number) => {
        if (typeof theme !== "string" || theme.trim().length === 0) {
          this.result.addError(`keyThemes[${index}]`, "must be a non-empty string", theme);
          return false;
        }
        if (theme.length > 100) {
          this.result.addError(`keyThemes[${index}]`, "must be at most 100 characters", theme);
          return false;
        }
        return true;
      });
    }

    return this.result;
  }

  private validateProfessionalAdvice(advice: unknown): void {
    if (typeof advice !== "object" || advice === null) {
      this.result.addError("professionalAdvice", "must be an object", advice);
      return;
    }

    const adviceObj = advice as Record<string, unknown>;
    const validProfessions = [
      "Software Engineer",
      "ML Engineer",
      "Data Scientist",
      "Product Manager",
      "Designer",
      "Founder",
      "Investor",
      "Researcher",
      "DevOps Engineer",
      "Security Engineer",
      "Content Creator",
      "Marketer",
    ];

    for (const [profession, tips] of Object.entries(adviceObj)) {
      if (!validProfessions.includes(profession)) {
        this.result.addError(
          `professionalAdvice.${profession}`,
          `invalid profession, must be one of: ${validProfessions.join(", ")}`,
          profession
        );
        continue;
      }

      this.validateArray(
        `professionalAdvice.${profession}`,
        tips,
        1,
        5,
        (tip: unknown, index: number) => {
          if (typeof tip !== "string" || tip.trim().length === 0) {
            this.result.addError(
              `professionalAdvice.${profession}[${index}]`,
              "must be a non-empty string",
              tip
            );
            return false;
          }
          if (tip.length > 500) {
            this.result.addError(
              `professionalAdvice.${profession}[${index}]`,
              "must be at most 500 characters",
              tip
            );
            return false;
          }
          return true;
        }
      );
    }
  }

  private validateProductPlays(plays: unknown): void {
    if (!Array.isArray(plays)) {
      this.result.addError("productPlays", "must be an array", plays);
      return;
    }

    plays.forEach((play, index) => {
      if (typeof play !== "object" || play === null) {
        this.result.addError(`productPlays[${index}]`, "must be an object", play);
        return;
      }

      const playObj = play as any;

      if (!this.validateRequired(`productPlays[${index}].app`, playObj.app)) return;
      this.validateString(`productPlays[${index}].app`, playObj.app, 1, 100);

      if (!this.validateRequired(`productPlays[${index}].suggestion`, playObj.suggestion)) return;
      this.validateString(`productPlays[${index}].suggestion`, playObj.suggestion, 10, 1000);

      if (playObj.relevance !== undefined) {
        this.validateEnum(
          `productPlays[${index}].relevance`,
          playObj.relevance,
          ["low", "medium", "high"]
        );
      }

      if (playObj.reasoning !== undefined) {
        this.validateString(`productPlays[${index}].reasoning`, playObj.reasoning, 0, 500);
      }
    });
  }

  private validateMetadata(metadata: unknown): void {
    if (typeof metadata !== "object" || metadata === null) {
      this.result.addError("metadata", "must be an object", metadata);
      return;
    }

    const meta = metadata as any;

    if (meta.totalEmails !== undefined) {
      this.validateNumber("metadata.totalEmails", meta.totalEmails, 0, 10000);
    }

    if (meta.processedAt !== undefined) {
      this.validateDate("metadata.processedAt", meta.processedAt);
    }

    if (meta.timeRange !== undefined) {
      if (typeof meta.timeRange !== "object" || meta.timeRange === null) {
        this.result.addError("metadata.timeRange", "must be an object", meta.timeRange);
      } else {
        if (meta.timeRange.start !== undefined) {
          this.validateDate("metadata.timeRange.start", meta.timeRange.start);
        }
        if (meta.timeRange.end !== undefined) {
          this.validateDate("metadata.timeRange.end", meta.timeRange.end);
        }
      }
    }

    if (meta.sources !== undefined) {
      this.validateArray("metadata.sources", meta.sources, 0, 100, (source: unknown, index: number) => {
        if (typeof source !== "string" || source.trim().length === 0) {
          this.result.addError(`metadata.sources[${index}]`, "must be a non-empty string", source);
          return false;
        }
        return true;
      });
    }
  }

  private validateDate(field: string, value: unknown): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      this.result.addError(field, "must be a valid date", value);
      return false;
    }

    return true;
  }
}