import { createLogger } from "./logger";

const log = createLogger("EnhancedCircuitBreaker");

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
  halfOpenMaxAttempts?: number;
}

export class EnhancedCircuitBreaker {
  private static breakers: Map<string, EnhancedCircuitBreaker> = new Map();

  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private halfOpenAttempts = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitoringPeriod: number;
  private readonly halfOpenMaxAttempts: number;

  constructor(
    private name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 120000; // 2 minutes
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
  }

  static getBreaker(name: string, options?: CircuitBreakerOptions): EnhancedCircuitBreaker {
    if (!EnhancedCircuitBreaker.breakers.has(name)) {
      EnhancedCircuitBreaker.breakers.set(name, new EnhancedCircuitBreaker(name, options));
    }
    return EnhancedCircuitBreaker.breakers.get(name)!;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenAttempts = 0;
        log.info({ circuit: this.name }, "Circuit entering half-open state");
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.successCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        log.info({ circuit: this.name }, "Circuit closed after successful half-open period");
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      log.warn({ circuit: this.name }, "Circuit opened from half-open state");
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      log.warn(
        { circuit: this.name, failures: this.failureCount },
        "Circuit opened due to failure threshold"
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.resetTimeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.halfOpenAttempts = 0;
  }
}
