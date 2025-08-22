import { ContextualError, logErrorWithContext, RequestTracer } from "./error-utils";
import { createLogger } from "./logger";

const log = createLogger("circuit-breaker");

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
  operationTimeout?: number;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
}

/**
 * Circuit Breaker pattern implementation for protecting external service calls
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailTime?: Date;
  private halfOpenAttempts = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly monitoringPeriod: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly operationTimeout: number;
  private readonly onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;

  constructor(
    private name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
    this.operationTimeout = options.operationTimeout || 120000; // 2 minutes default
    this.onStateChange = options.onStateChange;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const trace = RequestTracer.startTrace(`CircuitBreaker.${this.name}`);

    try {
      // Check if circuit should transition from OPEN to HALF_OPEN
      if (this.state === CircuitState.OPEN && this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      }

      // If circuit is OPEN, fail fast
      if (this.state === CircuitState.OPEN) {
        const error = new ContextualError(`Circuit breaker '${this.name}' is OPEN`, {
          code: "CIRCUIT_OPEN",
          context: {
            circuitName: this.name,
            state: this.state,
            failures: this.failures,
            lastFailTime: this.lastFailTime,
          },
          traceId: trace.traceId,
        });
        (error as any).circuitBreakerOpen = true;
        throw error;
      }

      RequestTracer.addStep(trace.traceId, "executeOperation", {
        state: this.state,
        failures: this.failures,
      });

      // Add timeout wrapper
      const result = await this.executeWithTimeout(operation, trace);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();

      logErrorWithContext(log, error, `Circuit breaker '${this.name}' operation failed`, trace);

      throw error;
    } finally {
      RequestTracer.endTrace(trace.traceId);
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>, trace: any): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new ContextualError(`Operation timed out after ${this.operationTimeout}ms`, {
          code: "OPERATION_TIMEOUT",
          context: {
            circuitName: this.name,
            timeout: this.operationTimeout,
            state: this.state,
          },
          traceId: trace.traceId,
        });
        reject(error);
      }, this.operationTimeout);

      try {
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Execute with fallback when circuit is open
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    fallback: () => T | Promise<T>
  ): Promise<T> {
    try {
      return await this.execute(operation);
    } catch (error) {
      if ((error as any).circuitBreakerOpen) {
        log.warn(`Circuit breaker '${this.name}' is open, using fallback`);
        return await fallback();
      }
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failures = 0;
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.halfOpenMaxAttempts) {
        // Enough successful attempts in HALF_OPEN, close the circuit
        this.transitionTo(CircuitState.CLOSED);
        this.halfOpenAttempts = 0;
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailTime = new Date();
    this.successes = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN reopens the circuit
      this.transitionTo(CircuitState.OPEN);
      this.halfOpenAttempts = 0;
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failures >= this.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailTime) {
      return false;
    }

    const now = new Date();
    const timeSinceLastFailure = now.getTime() - this.lastFailTime.getTime();

    return timeSinceLastFailure >= this.resetTimeout;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    log.info(`Circuit breaker '${this.name}' transitioned from ${oldState} to ${newState}`);

    if (this.onStateChange) {
      this.onStateChange(oldState, newState);
    }

    // Reset counters when closing
    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailTime?: Date;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailTime: this.lastFailTime,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.lastFailTime = undefined;
    this.halfOpenAttempts = 0;
  }

  /**
   * Manually open the circuit breaker
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
    this.lastFailTime = new Date();
  }
}

/**
 * Circuit Breaker Registry for managing multiple breakers
 */
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker
   */
  static getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!CircuitBreakerRegistry.breakers.has(name)) {
      CircuitBreakerRegistry.breakers.set(name, new CircuitBreaker(name, options));
    }
    return CircuitBreakerRegistry.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(CircuitBreakerRegistry.breakers);
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of CircuitBreakerRegistry.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get statistics for all breakers
   */
  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, breaker] of CircuitBreakerRegistry.breakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Clear all breakers from registry
   */
  static clear(): void {
    CircuitBreakerRegistry.breakers.clear();
  }
}
