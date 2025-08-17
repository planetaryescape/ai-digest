# Structured Logging with Pino

This project uses [Pino](https://github.com/pinojs/pino) for structured logging throughout the codebase.

## Features

- **Structured JSON logging** for production environments
- **Pretty-printed logs** for local development
- **Performance tracking** with built-in timers
- **HTTP request/response logging** helpers
- **Error logging** with stack traces
- **Azure Functions integration** with proper invocation context

## Usage

### Basic Logging

```typescript
import { createLogger } from "./lib/logger";

const log = createLogger("module-name");

log.info("Simple message");
log.info({ userId: 123 }, "User logged in");
log.warn({ retries: 3 }, "Operation retry");
log.error({ code: "ERR_001" }, "Operation failed");
```

### Function Invocation Logging

For Azure Functions, use the invocation helper:

```typescript
import { logFunctionInvocation } from "./lib/logger";

const funcLog = logFunctionInvocation(
  log,
  "function-name",
  context.invocationId
);
funcLog.info("Function started");
```

### Performance Tracking

Track operation duration automatically:

```typescript
import { createTimer } from "./lib/logger";

const timer = createTimer(log, "database-query");
// ... perform operation ...
timer.end({ recordCount: 100 }); // Logs: "database-query completed in 123ms"
```

### HTTP Logging

Log HTTP requests and responses:

```typescript
import { logHttpRequest, logHttpResponse } from "./lib/logger";

logHttpRequest(log, {
  method: "GET",
  url: "/api/users",
  headers: { Authorization: "Bearer xxx" },
  query: { page: "1" },
});

logHttpResponse(log, {
  status: 200,
  duration: 145,
});
```

### Error Logging

Properly log errors with stack traces:

```typescript
import { logError } from "./lib/logger";

try {
  // ... code that might throw ...
} catch (error) {
  logError(log, error, "Failed to process request");
}
```

## Log Levels

- `trace` - Most detailed logging
- `debug` - Debugging information
- `info` - General information (default in production)
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Fatal errors

Set log level via environment variable:

```bash
LOG_LEVEL=debug bun run dev
```

## Production vs Development

- **Production**: JSON formatted logs for Azure Application Insights
- **Development**: Pretty-printed, colorized logs for readability

The logger automatically detects the environment based on:

- `NODE_ENV` environment variable
- `AZURE_FUNCTIONS_ENVIRONMENT` environment variable

## Best Practices

1. **Create module-specific loggers**: Use `createLogger("module-name")` for each module
2. **Include relevant context**: Add metadata objects as the first parameter
3. **Use timers for performance**: Track slow operations with `createTimer()`
4. **Avoid logging sensitive data**: Don't log passwords, tokens, or PII
5. **Use appropriate log levels**: Reserve `error` for actual errors, use `debug` for verbose output
