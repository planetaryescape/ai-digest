---
name: auto-generated-structured-logging-with-pino
description: Structured logging with Pino for this project. Environment-aware configuration, context-based child loggers, ILogger adapter for compatibility. Triggers on "logging", "logger", "createLogger", "pino", "structured logging".
---

# Structured Logging with Pino

Project uses Pino for structured logging with environment detection (Lambda/Azure/dev/test).

## createLogger with Context

Create child loggers per module:

```typescript
// From functions/lib/logger.ts
import { createLogger } from "../lib/logger";

const log = createLogger("digest-processor");
```

Each context gets own child logger with `context` field. All logs tagged automatically.

## Environment Detection

Auto-detects platform from env vars:

```typescript
// From functions/lib/logger.ts
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const isAzure = !!process.env.AZURE_FUNCTIONS_ENVIRONMENT;
const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";
```

Behavior per environment:
- **Test**: Silent (`level: "silent"`)
- **Dev**: Pretty-printed with colors (`pino-pretty`)
- **Lambda/Azure**: JSON (no transport)
- **Prod**: JSON (no transport)

## pino-pretty Conditional

Only use `pino-pretty` in dev, not Lambda/Azure/test:

```typescript
// From functions/lib/logger.ts
transport:
  isDev && !isLambda && !isAzure && !isTest
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
```

Production logs JSON, dev logs readable.

## Base Logger Fields

Lambda includes AWS context:

```typescript
// From functions/lib/logger.ts
base: isLambda
  ? {
      environment: "lambda",
      function: process.env.AWS_LAMBDA_FUNCTION_NAME,
      region: process.env.AWS_REGION,
      memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    }
  : isAzure
    ? {
        environment: "azure",
        function: process.env.AZURE_FUNCTIONS_FUNCTION_NAME,
        region: process.env.AZURE_REGION,
      }
    : {
        environment: isDev ? "development" : "production",
      },
```

Every log includes platform context.

## ILogger Adapter Pattern

For backward compatibility with existing code:

```typescript
// From functions/lib/logger.ts
export class PinoLoggerAdapter implements ILogger {
  private logger: pino.Logger;

  constructor(context: string) {
    this.logger = createLogger(context);
  }

  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.info({ data: args }, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, ...args: unknown[]): void {
    const error = args.find((arg) => arg instanceof Error);
    const otherArgs = args.filter((arg) => !(arg instanceof Error));

    if (error) {
      this.logger.error(
        { err: error, data: otherArgs.length > 0 ? otherArgs : undefined },
        message
      );
    } else if (args.length > 0) {
      this.logger.error({ data: args }, message);
    } else {
      this.logger.error(message);
    }
  }
}

export const Logger = PinoLoggerAdapter;
```

Use when constructor needs `ILogger` interface.

## Structured Metadata

Pass objects as first arg, message as second:

```typescript
// From functions/core/digest-processor.ts
this.logger.info("Fetched emails", {
  metadata: emailBatch.metadata.length,
  totalFetched: emailBatch.stats.totalFetched
});

this.logger.error("Gmail authentication failed", emailBatch.authError);
```

Pino indexes object fields. Queryable in CloudWatch/Azure Logs.

## Error Logging Pattern

Errors get special `err` field:

```typescript
// From functions/lib/logger.ts
export function logError(logger: pino.Logger, error: Error, message: string): void {
  logger.error({ err: error }, message);
}
```

Use `err` key for proper stack trace serialization.

## Timer Helper

Track operation durations:

```typescript
// From functions/lib/logger.ts
export function createTimer(logger: pino.Logger, operation: string) {
  const start = Date.now();
  return {
    end: (metadata?: Record<string, any>) => {
      const duration = Date.now() - start;
      logger.info({ duration, operation, ...metadata }, `Timer: ${operation} completed`);
      return duration;
    },
  };
}

// Usage
const timer = createTimer(log, "fetch-emails");
// ... do work
timer.end({ emailCount: 50 });
```

Logs duration with structured metadata.

## Usage Patterns

Direct pino logger (preferred):

```typescript
const log = createLogger("my-module");
log.info({ userId: 123 }, "User logged in");
log.error({ err: error }, "Failed to process");
```

ILogger adapter (compatibility):

```typescript
export class DigestProcessor {
  private logger: ILogger;

  constructor(options: DigestProcessorOptions) {
    this.logger = options.logger || log;
  }
}
```

Inject logger for testability.

## Key Files

- `functions/lib/logger.ts` - Main logger setup
- `functions/lib/interfaces/logger.ts` - ILogger interface
- `functions/core/digest-processor.ts` - Usage examples

## Avoid

- Don't call `baseLogger` directly - use `createLogger()`
- Don't use `console.log()` - always use structured logger
- Don't log sensitive data (tokens, passwords)
- Don't concatenate strings - use structured fields:
  ```typescript
  // Bad
  log.info(`Processed ${count} emails`);

  // Good
  log.info({ count }, "Processed emails");
  ```
- Don't override `err` field - reserved for Error objects
- Don't add pino-pretty in production - breaks JSON parsing
