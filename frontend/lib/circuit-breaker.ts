import CircuitBreaker from "opossum";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
  halfOpenMaxAttempts?: number;
}

export class CircuitBreakerWrapper {
  private breaker: CircuitBreaker;
  private readonly service: string;

  private static breakers = new Map<string, CircuitBreakerWrapper>();

  constructor(
    service: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.service = service;

    const opossumOptions: CircuitBreaker.Options = {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: options.resetTimeout ?? 60000,
      rollingCountTimeout: 10000,
      rollingCountBuckets: 10,
      name: service,
      enabled: true,
      allowWarmUp: false,
      volumeThreshold: 1,
      errorThreshold: options.failureThreshold ?? 5,
    };

    this.breaker = new CircuitBreaker(
      async (fn: () => Promise<any>) => fn(),
      opossumOptions
    );

    this.breaker.on("open", () => {
      console.log(`Circuit breaker OPEN for ${service}`);
    });

    this.breaker.on("halfOpen", () => {
      console.log(`Circuit breaker HALF_OPEN for ${service}`);
    });

    this.breaker.on("close", () => {
      console.log(`Circuit breaker CLOSED for ${service} (recovered)`);
    });

    this.breaker.on("failure", (error) => {
      console.error(`Circuit breaker failure for ${service}`, {
        error: error.message,
      });
    });

    CircuitBreakerWrapper.breakers.set(service, this);

    console.log(
      `Circuit breaker initialized for ${service}`,
      {
        failureThreshold: options.failureThreshold ?? 5,
        resetTimeout: options.resetTimeout ?? 60000,
      }
    );
  }

  static getBreaker(service: string, options?: CircuitBreakerOptions): CircuitBreakerWrapper {
    if (!CircuitBreakerWrapper.breakers.has(service)) {
      new CircuitBreakerWrapper(service, options);
    }
    return CircuitBreakerWrapper.breakers.get(service)!;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.breaker.fire(fn) as T;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Breaker is open")) {
        throw new Error(`Circuit breaker OPEN for ${this.service}`);
      }
      throw error;
    }
  }

  getStats() {
    const stats = this.breaker.toJSON();
    const state = this.breaker.opened 
      ? "OPEN" 
      : this.breaker.halfOpen 
        ? "HALF_OPEN" 
        : "CLOSED";

    return {
      state: state as CircuitState,
      failures: stats.failures || 0,
      successes: stats.successes || 0,
      lastFailureTime: stats.lastCircuitOpen || 0,
      lastError: undefined,
    };
  }
}

export const CircuitBreaker = CircuitBreakerWrapper;