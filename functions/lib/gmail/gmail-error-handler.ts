import { Result, ok, err } from "neverthrow";
import type { GmailClient } from "../gmail";
import { createLogger } from "../logger";

const log = createLogger("gmail-error-handler");

export interface GmailError {
  code: string;
  message: string;
}

export interface GmailErrorContext {
  operation: string;
  attemptNumber: number;
  lastError?: Error;
}

export class GmailErrorHandler {
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff

  /**
   * Wrap Gmail operations with comprehensive error handling
   */
  async executeWithRecovery<T>(
    operation: () => Promise<T>,
    context: { operation: string; client?: GmailClient }
  ): Promise<Result<T, GmailError>> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        log.debug({ operation: context.operation, attempt }, "Executing Gmail operation");
        const result = await operation();

        if (attempt > 0) {
          log.info({ operation: context.operation, attempt }, "Operation succeeded after retry");
        }

        return ok(result);
      } catch (error: any) {
        lastError = error;

        log.warn(
          { operation: context.operation, attempt, error: error.message },
          "Gmail operation failed"
        );

        // Analyze the error and determine if it's recoverable
        const recovery = this.analyzeError(error, attempt);

        if (!recovery.isRecoverable) {
          log.error(
            { operation: context.operation, error: error.message },
            "Non-recoverable Gmail error"
          );

          return err({
            code: recovery.errorCode,
            message: recovery.userMessage,
          });
        }

        // If we have more retries, wait and try again
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAYS[attempt] || 5000;
          log.info(
            { operation: context.operation, delay, nextAttempt: attempt + 1 },
            "Waiting before retry"
          );

          await this.delay(delay);

          // If token error and we have a client, try to refresh
          if (recovery.errorCode === "AUTH_ERROR" && context.client) {
            log.info("Attempting token refresh before retry");
            const refreshResult = await context.client.validateAccess();

            if (refreshResult.isErr()) {
              log.error({ error: refreshResult.error }, "Token refresh failed");
              return err({
                code: "TOKEN_REFRESH_FAILED",
                message: "Gmail authentication failed. Please run 'bun run refresh:gmail' to fix.",
              });
            }
          }
        }
      }
    }

    // All retries exhausted
    log.error(
      { operation: context.operation, attempts: this.MAX_RETRIES },
      "All Gmail operation retries exhausted"
    );

    return err({
      code: "MAX_RETRIES_EXCEEDED",
      message: `Gmail operation '${context.operation}' failed after ${this.MAX_RETRIES} attempts. ${lastError?.message || "Unknown error"}`,
    });
  }

  /**
   * Analyze error to determine if it's recoverable
   */
  private analyzeError(
    error: any,
    attemptNumber: number
  ): {
    isRecoverable: boolean;
    errorCode: string;
    userMessage: string;
  } {
    const errorMessage = error.message || "";
    const errorCode = error.code;

    // Token/Auth errors - recoverable on first attempts
    if (
      errorCode === 401 ||
      errorMessage.includes("invalid_grant") ||
      errorMessage.includes("Token has been expired") ||
      errorMessage.includes("Invalid Credentials")
    ) {
      return {
        isRecoverable: attemptNumber < 2, // Try to refresh token once
        errorCode: "AUTH_ERROR",
        userMessage: "Gmail authentication failed. Token may need refresh.",
      };
    }

    // Rate limiting - always recoverable with backoff
    if (
      errorCode === 429 ||
      errorMessage.includes("Rate Limit") ||
      errorMessage.includes("quotaExceeded")
    ) {
      return {
        isRecoverable: true,
        errorCode: "RATE_LIMIT",
        userMessage: "Gmail API rate limit reached. Waiting before retry.",
      };
    }

    // Network errors - usually recoverable
    if (
      errorMessage.includes("ECONNRESET") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("socket hang up")
    ) {
      return {
        isRecoverable: true,
        errorCode: "NETWORK_ERROR",
        userMessage: "Network error accessing Gmail. Retrying...",
      };
    }

    // Service errors - sometimes recoverable
    if (
      errorCode === 500 ||
      errorCode === 502 ||
      errorCode === 503 ||
      errorMessage.includes("Service Unavailable")
    ) {
      return {
        isRecoverable: attemptNumber < 2,
        errorCode: "SERVICE_ERROR",
        userMessage: "Gmail service temporarily unavailable.",
      };
    }

    // Permission errors - not recoverable
    if (
      errorCode === 403 ||
      errorMessage.includes("Forbidden") ||
      errorMessage.includes("insufficient permissions")
    ) {
      return {
        isRecoverable: false,
        errorCode: "PERMISSION_ERROR",
        userMessage: "Gmail API permissions insufficient. Check OAuth scopes.",
      };
    }

    // Invalid request - not recoverable
    if (
      errorCode === 400 ||
      errorMessage.includes("Bad Request") ||
      errorMessage.includes("Invalid")
    ) {
      return {
        isRecoverable: false,
        errorCode: "INVALID_REQUEST",
        userMessage: `Invalid Gmail API request: ${errorMessage}`,
      };
    }

    // Unknown errors - try once more
    return {
      isRecoverable: attemptNumber === 0,
      errorCode: "UNKNOWN_ERROR",
      userMessage: `Gmail API error: ${errorMessage}`,
    };
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
