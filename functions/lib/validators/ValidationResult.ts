export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export class ValidationResult {
  private errors: ValidationError[] = [];

  addError(field: string, message: string, value?: unknown): void {
    this.errors.push({ field, message, value });
  }

  merge(other: ValidationResult): void {
    this.errors.push(...other.errors);
  }

  get isValid(): boolean {
    return this.errors.length === 0;
  }

  get errorMessages(): string[] {
    return this.errors.map((e) => `${e.field}: ${e.message}`);
  }

  get errorDetails(): ValidationError[] {
    return [...this.errors];
  }

  toString(): string {
    return this.errorMessages.join("; ");
  }
}