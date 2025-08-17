import { createLogger } from "../logger";

export type ValidationRule<T = any> = (value: T) => boolean | string;

export interface ValidationOptions {
  parameterIndex?: number;
  rules?: ValidationRule[];
  throwOnFailure?: boolean;
}

/**
 * Decorator to validate method parameters
 */
export function Validate(options: ValidationOptions = {}) {
  const { parameterIndex = 0, rules = [], throwOnFailure = true } = options;

  return (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const logger = createLogger(`${className}.${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      const valueToValidate = args[parameterIndex];

      for (const rule of rules) {
        const result = rule(valueToValidate);

        if (result === false || typeof result === "string") {
          const errorMessage =
            typeof result === "string"
              ? result
              : `Validation failed for parameter at index ${parameterIndex}`;

          logger.error(errorMessage, { value: valueToValidate });

          if (throwOnFailure) {
            throw new Error(errorMessage);
          }

          return null;
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (value: any) => (value !== null && value !== undefined) || "Value is required",

  notEmpty: (value: any) => {
    if (typeof value === "string") return value.trim().length > 0 || "String cannot be empty";
    if (Array.isArray(value)) return value.length > 0 || "Array cannot be empty";
    if (typeof value === "object") return Object.keys(value).length > 0 || "Object cannot be empty";
    return true;
  },

  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) || "Invalid email format";
  },

  url: (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return "Invalid URL format";
    }
  },

  minLength: (min: number) => (value: string | any[]) => {
    return value.length >= min || `Minimum length is ${min}`;
  },

  maxLength: (max: number) => (value: string | any[]) => {
    return value.length <= max || `Maximum length is ${max}`;
  },

  range: (min: number, max: number) => (value: number) => {
    return (value >= min && value <= max) || `Value must be between ${min} and ${max}`;
  },
};
