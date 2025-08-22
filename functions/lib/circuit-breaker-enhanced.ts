import OpossumCircuitBreaker from "opossum";
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
  private breaker: OpossumCircuitBreaker;

  constructor(
    private name: string,
    options: CircuitBreakerOptions = {}
  ) {
    const opossumOptions: OpossumCircuitBreaker.Options = {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: options.resetTimeout || 60000,
      rollingCountTimeout: options.monitoringPeriod || 120000,
      rollingCountBuckets: 10,
      name: name,
      enabled: true,
      allowWarmUp: false,
      volumeThreshold: options.failureThreshold || 5,
    };

    this.breaker = new OpossumCircuitBreaker(
      async (fn: () => Promise<any>) => await fn(),
      opossumOptions
    );

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

    this.breaker.on("success", () => {
      log.debug({ circuit: this.name }, "Circuit breaker success");
    });

    this.breaker.on("timeout", () => {
      log.error({ circuit: this.name }, "Circuit breaker timeout");
    });

    this.breaker.on("reject", () => {
      log.warn({ circuit: this.name }, "Circuit breaker rejected request");
    });

    this.breaker.on("fallback", (data) => {
      log.info({ circuit: this.name, data }, "Circuit breaker fallback executed");
    });

    this.breaker.on("semaphoreLocked", () => {
      log.warn({ circuit: this.name }, "Circuit breaker semaphore locked");
    });

    this.breaker.on("healthCheckFailed", (error) => {
      log.error(
        { circuit: this.name, error: error.message },
        "Circuit breaker health check failed"
      );
    });
  }

  static getBreaker(name: string, options?: CircuitBreakerOptions): EnhancedCircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new EnhancedCircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

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

  reset(): void {
    this.breaker.close();
  }
}
