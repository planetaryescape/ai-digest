export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxAttempts?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private lastError?: Error;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxAttempts: number;

  private static breakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly service: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 3;

    CircuitBreaker.breakers.set(service, this);
  }

  static getBreaker(service: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!CircuitBreaker.breakers.has(service)) {
      new CircuitBreaker(service, options);
    }
    return CircuitBreaker.breakers.get(service)!;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit breaker OPEN for ${this.service}`);
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime > this.resetTimeout;
  }

  private transitionToHalfOpen(): void {
    this.state = "HALF_OPEN";
    this.halfOpenAttempts = 0;
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === "HALF_OPEN") {
      this.successes++;
      this.halfOpenAttempts++;

      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.state = "CLOSED";
        this.successes = 0;
      }
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.lastError = error;

    if (this.state === "HALF_OPEN" || this.failures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastError: this.lastError?.message,
    };
  }
}
