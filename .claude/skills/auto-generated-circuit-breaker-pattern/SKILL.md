---
name: auto-generated-circuit-breaker-pattern
description: Opossum circuit breaker patterns for resilience. Singleton pattern per service, timeout from env, event listeners. Triggers on "circuit breaker", "resilience", "external api", "failure handling", "opossum".
---

# Circuit Breaker Pattern

Project uses Opossum library for circuit breakers on all external APIs (Gmail, OpenAI, Firecrawl, Brave). Key pattern: singleton per service name with shared state.

## Singleton Pattern

Use `getBreaker()` static method to get or create breaker per service:

```typescript
// From functions/lib/circuit-breaker-enhanced.ts
export class EnhancedCircuitBreaker {
  private static breakers: Map<string, EnhancedCircuitBreaker> = new Map();

  static getBreaker(name: string, options?: CircuitBreakerOptions): EnhancedCircuitBreaker {
    if (!EnhancedCircuitBreaker.breakers.has(name)) {
      EnhancedCircuitBreaker.breakers.set(name, new EnhancedCircuitBreaker(name, options));
    }
    return EnhancedCircuitBreaker.breakers.get(name)!;
  }
}
```

**Important**: This ensures single breaker instance per service across the entire execution. Multiple calls to `getBreaker("gmail")` return same instance.

## Initialization in Processor

Initialize breakers once in constructor:

```typescript
// From functions/core/digest-processor.ts
export class DigestProcessor {
  private gmailBreaker: EnhancedCircuitBreaker;
  private openaiBreaker: EnhancedCircuitBreaker;
  private firecrawlBreaker: EnhancedCircuitBreaker;
  private braveBreaker: EnhancedCircuitBreaker;

  constructor(options: DigestProcessorOptions) {
    // Initialize circuit breakers
    this.gmailBreaker = EnhancedCircuitBreaker.getBreaker("gmail");
    this.openaiBreaker = EnhancedCircuitBreaker.getBreaker("openai");
    this.firecrawlBreaker = EnhancedCircuitBreaker.getBreaker("firecrawl");
    this.braveBreaker = EnhancedCircuitBreaker.getBreaker("brave");
  }
}
```

## Opossum Configuration

Backend timeout from environment variable:

```typescript
// From functions/lib/circuit-breaker-enhanced.ts
constructor(private name: string, options: CircuitBreakerOptions = {}) {
  // Get timeout from environment or use a reasonable default (3 minutes)
  const timeout = Number(process.env.CIRCUIT_BREAKER_TIMEOUT) || 180000;

  const opossumOptions: OpossumCircuitBreaker.Options = {
    timeout: timeout,
    errorThresholdPercentage: 50,
    resetTimeout: options.resetTimeout || 60000,
    rollingCountTimeout: options.monitoringPeriod || 120000,
    rollingCountBuckets: 10,
    name: name,
    enabled: true,
    allowWarmUp: false,
    volumeThreshold: options.failureThreshold || 5,
  };
}
```

**Key values**:
- `timeout`: 180s (3min) default, override with `CIRCUIT_BREAKER_TIMEOUT`
- `errorThresholdPercentage`: 50% failures triggers open
- `resetTimeout`: 60s before trying half-open
- `volumeThreshold`: 5 requests minimum before opening

Frontend uses shorter timeout:

```typescript
// From frontend/lib/circuit-breaker.ts
const opossumOptions: OpossumCircuitBreaker.Options = {
  timeout: 30000, // 30s for frontend
  errorThresholdPercentage: 50,
  resetTimeout: options.resetTimeout ?? 60000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: service,
  enabled: true,
  allowWarmUp: false,
  volumeThreshold: options.failureThreshold ?? 5,
};
```

## Execute Wrapper Pattern

Wrap async operations with `execute()`:

```typescript
// From functions/core/digest-processor.ts
const emailBatch = await this.gmailBreaker.execute(() =>
  this.emailFetcher.fetchEmails({
    mode: dateRange ? "historical" : "weekly",
    startDate: dateRange?.start,
    endDate: dateRange?.end,
    ...(maxEmails && { maxResults: maxEmails }),
  })
);
```

Implementation catches "Breaker is open" error:

```typescript
// From functions/lib/circuit-breaker-enhanced.ts
async execute<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await this.breaker.fire(fn);
    return result as T;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Breaker is open")) {
      throw new Error(`Circuit breaker ${this.name} is OPEN`);
    }
    throw error;
  }
}
```

Always pass function reference, not executed function:

```typescript
// CORRECT
await breaker.execute(() => someAsyncCall())

// WRONG
await breaker.execute(someAsyncCall()) // Already executed!
```

## Event Listeners

Backend uses structured logging:

```typescript
// From functions/lib/circuit-breaker-enhanced.ts
this.breaker.on("open", () => {
  log.warn({ circuit: this.name }, "Circuit opened due to failure threshold");
});

this.breaker.on("halfOpen", () => {
  log.info({ circuit: this.name }, "Circuit entering half-open state");
});

this.breaker.on("close", () => {
  log.info({ circuit: this.name }, "Circuit closed after successful half-open period");
});

this.breaker.on("failure", (error) => {
  log.warn({ circuit: this.name, error: error.message }, "Circuit breaker failure");
});

this.breaker.on("timeout", () => {
  log.error({ circuit: this.name }, "Circuit breaker timeout");
});
```

Frontend uses console logging:

```typescript
// From frontend/lib/circuit-breaker.ts
this.breaker.on("open", () => {
  console.log(`Circuit breaker OPEN for ${service}`);
});

this.breaker.on("failure", (error) => {
  console.error(`Circuit breaker failure for ${service}`, {
    error: error.message,
  });
});
```

## State Tracking

Get current state and stats:

```typescript
// From functions/lib/circuit-breaker-enhanced.ts
getState(): CircuitState {
  if (this.breaker.opened) {
    return CircuitState.OPEN;
  }
  if (this.breaker.halfOpen) {
    return CircuitState.HALF_OPEN;
  }
  return CircuitState.CLOSED;
}

getStats() {
  const stats = this.breaker.stats;
  return {
    state: this.getState(),
    failureCount: stats.failures,
    successCount: stats.successes,
    lastFailureTime: undefined,
  };
}
```

Used in error reporting:

```typescript
// From functions/core/digest-processor.ts
const errorDetails = `
Circuit Breakers:
Gmail: ${this.gmailBreaker.getStats().state}
OpenAI: ${this.openaiBreaker.getStats().state}
Firecrawl: ${this.firecrawlBreaker.getStats().state}
Brave: ${this.braveBreaker.getStats().state}
`.trim();
```

## Manual Reset

Reset breaker to CLOSED state:

```typescript
// From functions/lib/circuit-breaker-enhanced.ts
reset(): void {
  this.breaker.close();
}
```

## Backend vs Frontend Differences

**Backend** (`functions/lib/circuit-breaker-enhanced.ts`):
- Timeout from env var (3min default)
- Structured logging with pino
- Exports `CircuitState` enum
- Class name: `EnhancedCircuitBreaker`

**Frontend** (`frontend/lib/circuit-breaker.ts`):
- Fixed 30s timeout
- Console logging
- Type alias for state
- Class name: `CircuitBreakerWrapper`
- Auto-registers in static map on construction

Both share:
- Singleton pattern via `getBreaker()`
- Same `execute()` wrapper
- Same Opossum options structure
- Same error handling pattern

## Key Files

- `functions/lib/circuit-breaker-enhanced.ts` - Backend implementation
- `frontend/lib/circuit-breaker.ts` - Frontend implementation
- `functions/core/digest-processor.ts` - Usage example with 4 breakers

## Avoid

- Don't create new breaker instances directly (use `getBreaker()`)
- Don't pass executed promises to `execute()` (use arrow functions)
- Don't ignore breaker state in error reports
- Don't use different timeout values inconsistently
- Don't skip event listener setup (needed for debugging)
