---
name: auto-generated-error-handling-with-neverthrow
description: Error handling patterns for this project. Uses neverthrow for new code, custom Result type for legacy. Includes retry logic, parallel execution, and circuit breaker integration. Triggers on "error handling", "Result type", "neverthrow", "ok", "err", "retry".
---

# Error Handling with neverthrow

Project uses `neverthrow` library for functional error handling. Mixed approach: neverthrow for new code, custom `ResultUtils` for legacy compatibility.

## Result Type Pattern

All error-prone operations return `Result<T, E>` instead of throwing:

```typescript
// From functions/lib/gmail/token-manager.ts
async getValidAccessToken(): Promise<Result<string, TokenError>> {
  try {
    if (this.tokenCache && this.isTokenValid(this.tokenCache)) {
      return ok(this.tokenCache.accessToken);
    }

    const currentToken = await this.oauth2Client.getAccessToken();

    if (currentToken.token) {
      return ok(currentToken.token);
    }

    return this.refreshAccessToken();
  } catch (error) {
    return this.handleTokenError(error);
  }
}
```

Check results with `isErr()` and `isOk()`:

```typescript
// From functions/lib/gmail/token-manager.ts
async validateToken(): Promise<Result<boolean, TokenError>> {
  const tokenResult = await this.getValidAccessToken();
  if (tokenResult.isErr()) {
    return err(tokenResult.error);
  }

  // Use token...
  return ok(true);
}
```

## ErrorHandler.wrap for Async Operations

Wrap async operations to convert exceptions into Results:

```typescript
// From functions/lib/error-handler.ts
static async wrap<T>(
  operation: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<Result<T, Error>> {
  const { logger, notify = false, critical = true, context = "operation" } = options;

  try {
    const data = await operation();
    return ok(data);
  } catch (error) {
    const errorMessage = ErrorHandler.getErrorMessage(error);
    const errorObject = error instanceof Error ? error : new Error(errorMessage);

    if (logger) {
      logger.error(`Error in ${context}:`, errorMessage, error);
    }

    // Send notification if requested
    if (notify) {
      try {
        await sendErrorNotification(
          process.env.ADMIN_EMAIL || "admin@example.com",
          errorObject,
          context
        );
      } catch (notifyError) {
        if (logger) {
          logger.error("Failed to send error notification:", notifyError);
        }
      }
    }

    // Re-throw if critical
    if (critical) {
      throw error;
    }

    return err(errorObject);
  }
}
```

Use `critical: false` to prevent throwing:

```typescript
const result = await ErrorHandler.wrap(
  async () => fetchData(),
  { critical: false, logger, context: "data fetch" }
);

if (result.isErr()) {
  // Handle error without try/catch
  logger.warn("Fetch failed:", result.error);
}
```

## Retry with Exponential Backoff

Uses `p-retry` library for automatic retries:

```typescript
// From functions/lib/error-handler.ts
static async retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  backoffMultiplier: number = 2,
  logger?: ILogger
): Promise<T> {
  return pRetry(operation, {
    retries: maxAttempts - 1,
    minTimeout: delayMs,
    factor: backoffMultiplier,
    onFailedAttempt: (error) => {
      if (logger) {
        const attemptNumber = error.attemptNumber;
        const retriesLeft = error.retriesLeft;
        logger.warn(
          `Attempt ${attemptNumber}/${maxAttempts} failed:`,
          ErrorHandler.getErrorMessage(error)
        );

        if (retriesLeft > 0) {
          const nextDelay = delayMs * backoffMultiplier ** (attemptNumber - 1);
          logger.info(`Retrying in ${nextDelay}ms...`);
        }
      }
    },
  });
}
```

Custom retry with error analysis:

```typescript
// From functions/lib/gmail/gmail-error-handler.ts
async executeWithRecovery<T>(
  operation: () => Promise<T>,
  context: { operation: string; client?: GmailClient }
): Promise<Result<T, GmailError>> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
    try {
      const result = await operation();
      return ok(result);
    } catch (error: any) {
      lastError = error;

      // Analyze the error and determine if it's recoverable
      const recovery = this.analyzeError(error, attempt);

      if (!recovery.isRecoverable) {
        return err({
          code: recovery.errorCode,
          message: recovery.userMessage,
        });
      }

      // Wait before retry
      if (attempt < this.MAX_RETRIES - 1) {
        const delay = this.RETRY_DELAYS[attempt] || 5000;
        await this.delay(delay);

        // Try token refresh for auth errors
        if (recovery.errorCode === "AUTH_ERROR" && context.client) {
          const refreshResult = await context.client.validateAccess();
          if (refreshResult.isErr()) {
            return err({
              code: "TOKEN_REFRESH_FAILED",
              message: "Gmail authentication failed.",
            });
          }
        }
      }
    }
  }

  return err({
    code: "MAX_RETRIES_EXCEEDED",
    message: `Operation failed after ${this.MAX_RETRIES} attempts.`,
  });
}
```

## Retryable Error Detection

Check if errors should be retried:

```typescript
// From functions/lib/error-handler.ts
static isRetryable(error: unknown): boolean {
  const errorMessage = ErrorHandler.getErrorMessage(error).toLowerCase();

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
```

Domain-specific error analysis:

```typescript
// From functions/lib/gmail/gmail-error-handler.ts
private analyzeError(error: any, attemptNumber: number): {
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
    errorMessage.includes("Token has been expired")
  ) {
    return {
      isRecoverable: attemptNumber < 2,
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
      userMessage: "Gmail API rate limit reached.",
    };
  }

  // Network errors - usually recoverable
  if (
    errorMessage.includes("ECONNRESET") ||
    errorMessage.includes("ETIMEDOUT")
  ) {
    return {
      isRecoverable: true,
      errorCode: "NETWORK_ERROR",
      userMessage: "Network error. Retrying...",
    };
  }

  // Permission errors - not recoverable
  if (errorCode === 403) {
    return {
      isRecoverable: false,
      errorCode: "PERMISSION_ERROR",
      userMessage: "Gmail API permissions insufficient.",
    };
  }

  // Unknown - try once more
  return {
    isRecoverable: attemptNumber === 0,
    errorCode: "UNKNOWN_ERROR",
    userMessage: `Gmail API error: ${errorMessage}`,
  };
}
```

## Parallel Error Handling

Execute multiple operations with controlled error propagation:

```typescript
// From functions/lib/error-handler.ts
static async parallel<T>(
  operations: Array<() => Promise<T>>,
  options: {
    stopOnError?: boolean;
    logger?: ILogger;
  } = {}
): Promise<Result<T, Error>[]> {
  const { stopOnError = false, logger } = options;

  if (stopOnError) {
    const results: Result<T, Error>[] = [];
    for (const operation of operations) {
      const result = await ErrorHandler.wrap(operation, { critical: false, logger });
      results.push(result);
      if (result.isErr()) {
        break;
      }
    }
    return results;
  }

  return Promise.all(operations.map((op) => ErrorHandler.wrap(op, { critical: false, logger })));
}
```

Use `stopOnError: true` for dependent operations, `false` for independent:

```typescript
// Stop on first error (for dependent operations)
const results = await ErrorHandler.parallel(
  [fetchUsers, processUsers, saveUsers],
  { stopOnError: true, logger }
);

// Continue on errors (for independent operations)
const results = await ErrorHandler.parallel(
  [fetchEmails, fetchCalendar, fetchContacts],
  { stopOnError: false, logger }
);
```

## Non-Critical Operations

Operations that can fail silently with optional fallback:

```typescript
// From functions/lib/error-handler.ts
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
```

Example usage:

```typescript
// Enrichment is optional
const enrichedData = await ErrorHandler.nonCritical(
  async () => enrichWithWebSearch(article),
  article, // Use original if enrichment fails
  logger
);
```

## Error Message Extraction

Sanitize errors from various sources:

```typescript
// From functions/lib/error-handler.ts
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
```

Create detailed error reports:

```typescript
// From functions/lib/error-handler.ts
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
```

## Legacy Result Type (Custom)

For backward compatibility, custom `ResultUtils` still exists:

```typescript
// From functions/lib/types/Result.ts
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Check with property access instead of methods
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

Utilities for custom Result:

```typescript
// From functions/lib/types/Result.ts
static async try<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const value = await fn();
    return ResultUtils.ok(value);
  } catch (error) {
    return ResultUtils.err(error as Error);
  }
}

static combine<T, E = Error>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    values.push(result.value);
  }

  return { ok: true, value: values };
}
```

## Key Files

- `functions/lib/error-handler.ts` - Main error handling utilities
- `functions/lib/types/Result.ts` - Legacy custom Result type
- `functions/lib/gmail/gmail-error-handler.ts` - Domain-specific Gmail error handling
- `functions/lib/gmail/token-manager.ts` - Real-world neverthrow usage example

## Conventions

**Use neverthrow for new code:**
- Import: `import { err, ok, type Result } from "neverthrow"`
- Check: `result.isErr()` and `result.isOk()`
- Access: `result.error` and `result.value`

**ErrorHandler patterns:**
- `wrap()` - Convert exceptions to Results
- `retry()` - Automatic retry with p-retry
- `parallel()` - Batch operations with error control
- `nonCritical()` - Fail-safe operations with fallback

**Custom error types:**
- Define structured errors with `code` and `message`
- Enables better error handling and user messaging

**Retry strategy:**
- Check `isRetryable()` before retrying
- Use exponential backoff (1s, 3s, 5s typical)
- Max 3 attempts for most operations
- Token refresh on auth errors

## Avoid

- Don't use bare try/catch for operations that should return Results
- Don't throw in functions that return `Result<T, E>`
- Don't retry non-retryable errors (permissions, bad requests)
- Don't mix custom Result checking (`result.ok`) with neverthrow (`result.isOk()`) in same file
- Don't skip error logging on non-critical operations
