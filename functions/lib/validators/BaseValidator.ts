import { ValidationResult } from "./ValidationResult";

export abstract class BaseValidator<T> {
  protected result: ValidationResult;

  constructor() {
    this.result = new ValidationResult();
  }

  abstract validate(data: T): ValidationResult;

  protected validateRequired(field: string, value: unknown): boolean {
    if (value === undefined || value === null || value === "") {
      this.result.addError(field, "is required", value);
      return false;
    }
    return true;
  }

  protected validateString(field: string, value: unknown, minLength = 0, maxLength = Infinity): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    if (value.length < minLength) {
      this.result.addError(field, `must be at least ${minLength} characters`, value);
      return false;
    }

    if (value.length > maxLength) {
      this.result.addError(field, `must be at most ${maxLength} characters`, value);
      return false;
    }

    return true;
  }

  protected validateNumber(field: string, value: unknown, min = -Infinity, max = Infinity): boolean {
    if (typeof value !== "number" || isNaN(value)) {
      this.result.addError(field, "must be a number", value);
      return false;
    }

    if (value < min) {
      this.result.addError(field, `must be at least ${min}`, value);
      return false;
    }

    if (value > max) {
      this.result.addError(field, `must be at most ${max}`, value);
      return false;
    }

    return true;
  }

  protected validateEmail(field: string, value: unknown): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      this.result.addError(field, "must be a valid email address", value);
      return false;
    }

    return true;
  }

  protected validateUrl(field: string, value: unknown): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    try {
      new URL(value);
      return true;
    } catch {
      this.result.addError(field, "must be a valid URL", value);
      return false;
    }
  }

  protected validateArray<U>(
    field: string,
    value: unknown,
    minLength = 0,
    maxLength = Infinity,
    itemValidator?: (item: U, index: number) => boolean
  ): boolean {
    if (!Array.isArray(value)) {
      this.result.addError(field, "must be an array", value);
      return false;
    }

    if (value.length < minLength) {
      this.result.addError(field, `must have at least ${minLength} items`, value);
      return false;
    }

    if (value.length > maxLength) {
      this.result.addError(field, `must have at most ${maxLength} items`, value);
      return false;
    }

    if (itemValidator) {
      let allValid = true;
      for (let i = 0; i < value.length; i++) {
        if (!itemValidator(value[i], i)) {
          allValid = false;
        }
      }
      return allValid;
    }

    return true;
  }

  protected validateEnum<U>(field: string, value: unknown, validValues: U[]): boolean {
    if (!validValues.includes(value as U)) {
      this.result.addError(
        field,
        `must be one of: ${validValues.join(", ")}`,
        value
      );
      return false;
    }
    return true;
  }

  protected validatePattern(field: string, value: unknown, pattern: RegExp, message?: string): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    if (!pattern.test(value)) {
      this.result.addError(field, message || `must match pattern ${pattern}`, value);
      return false;
    }

    return true;
  }
}