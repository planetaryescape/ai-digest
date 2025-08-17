import { createLogger } from "../logger";

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: "linear" | "exponential";
  shouldRetry?: (error: any) => boolean;
}

/**
 * Decorator to retry failed operations with configurable backoff
 */
export function Retry(options: RetryOptions = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = "exponential",
    shouldRetry = () => true,
  } = options;

  return (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const logger = createLogger(`${className}.${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;

          // Check if we should retry
          if (!shouldRetry(error)) {
            logger.debug("Error is not retryable, failing immediately");
            throw error;
          }

          // Don't sleep after the last attempt
          if (attempt < maxAttempts) {
            const waitTime =
              backoff === "exponential" ? delay * 2 ** (attempt - 1) : delay * attempt;

            logger.warn(`Attempt ${attempt} failed, retrying in ${waitTime}ms...`, {
              error: error instanceof Error ? error.message : String(error),
            });

            await new Promise((resolve) => setTimeout(resolve, waitTime));
          }
        }
      }

      logger.error(`All ${maxAttempts} attempts failed`);
      throw lastError;
    };

    return descriptor;
  };
}
