import { sendErrorNotification } from "./email";
import type { ILogger } from "./interfaces/logger";

export interface ErrorHandlerOptions {
  logger?: ILogger;
  notify?: boolean;
  critical?: boolean;
  context?: string;
}

export interface ErrorResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Centralized error handling utility
 */
export class ErrorHandler {
  /**
   * Wrap an async operation with error handling
   */
  static async wrap<T>(
    operation: () => Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<ErrorResult<T>> {
    const { logger, notify = false, critical = true, context = "operation" } = options;

    try {
      const data = await operation();
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = ErrorHandler.getErrorMessage(error);

      // Log the error
      if (logger) {
        logger.error(`Error in ${context}:`, errorMessage, error);
      } else {
      }

      // Send notification if requested
      if (notify) {
        try {
          await sendErrorNotification(
            process.env.ADMIN_EMAIL || "admin@example.com",
            error instanceof Error ? error : new Error(errorMessage),
            context
          );
        } catch (notifyError) {
          if (logger) {
            logger.error("Failed to send error notification:", notifyError);
          } else {
          }
        }
      }

      // Re-throw if critical
      if (critical) {
        throw error;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute an operation with retry logic
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000,
    backoffMultiplier: number = 2,
    logger?: ILogger
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (logger) {
          logger.warn(
            `Attempt ${attempt}/${maxAttempts} failed:`,
            ErrorHandler.getErrorMessage(error)
          );
        }

        if (attempt < maxAttempts) {
          const delay = delayMs * backoffMultiplier ** (attempt - 1);
          if (logger) {
            logger.info(`Retrying in ${delay}ms...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute multiple operations in parallel with error handling
   */
  static async parallel<T>(
    operations: Array<() => Promise<T>>,
    options: {
      stopOnError?: boolean;
      logger?: ILogger;
    } = {}
  ): Promise<ErrorResult<T>[]> {
    const { stopOnError = false, logger } = options;

    if (stopOnError) {
      const results: ErrorResult<T>[] = [];
      for (const operation of operations) {
        const result = await ErrorHandler.wrap(operation, { critical: false, logger });
        results.push(result);
        if (!result.success) {
          break;
        }
      }
      return results;
    }

    return Promise.all(operations.map((op) => ErrorHandler.wrap(op, { critical: false, logger })));
  }

  /**
   * Handle non-critical operations that can fail silently
   */
  static async nonCritical<T>(
    operation: () => Promise<T>,
    fallback?: T,
    logger?: ILogger
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      if (logger) {
        logger.debug("Non-critical operation failed:", ErrorHandler.getErrorMessage(error));
      }
      return fallback;
    }
  }

  /**
   * Extract error message from various error types
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      return String(error.message);
    }
    return "Unknown error";
  }

  /**
   * Create a detailed error report
   */
  static createErrorReport(
    error: unknown,
    context: {
      operation?: string;
      timestamp?: Date;
      metadata?: Record<string, unknown>;
    } = {}
  ): string {
    const timestamp = context.timestamp || new Date();
    const errorMessage = ErrorHandler.getErrorMessage(error);
    const stack = error instanceof Error ? error.stack : undefined;

    let report = `
Error Report
============
Timestamp: ${timestamp.toISOString()}
Operation: ${context.operation || "Unknown"}
Message: ${errorMessage}
    `.trim();

    if (stack) {
      report += `\n\nStack Trace:\n${stack}`;
    }

    if (context.metadata) {
      report += `\n\nMetadata:\n${JSON.stringify(context.metadata, null, 2)}`;
    }

    return report;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    const errorMessage = ErrorHandler.getErrorMessage(error).toLowerCase();

    // Common retryable error patterns
    const retryablePatterns = [
      "timeout",
      "timed out",
      "network",
      "econnrefused",
      "enotfound",
      "rate limit",
      "too many requests",
      "service unavailable",
      "gateway timeout",
      "bad gateway",
    ];

    return retryablePatterns.some((pattern) => errorMessage.includes(pattern));
  }
}
