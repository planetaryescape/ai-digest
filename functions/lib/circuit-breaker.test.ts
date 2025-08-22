import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitBreaker, CircuitBreakerRegistry, CircuitState } from "./circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker("test-breaker", {
      failureThreshold: 3,
      resetTimeout: 5000,
      halfOpenMaxAttempts: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    CircuitBreakerRegistry.clear();
  });

  describe("CLOSED state", () => {
    it("should start in CLOSED state", () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should execute successful operations", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await breaker.execute(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalled();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should count failures", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      try {
        await breaker.execute(operation);
      } catch {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.failures).toBe(1);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should transition to OPEN after threshold failures", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it("should reset failure count on success", async () => {
      const failOperation = vi.fn().mockRejectedValue(new Error("failure"));
      const successOperation = vi.fn().mockResolvedValue("success");

      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failOperation);
        } catch {
          // Expected
        }
      }

      // Succeed once
      await breaker.execute(successOperation);

      // Fail again - should not open circuit
      try {
        await breaker.execute(failOperation);
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failures).toBe(1);
    });
  });

  describe("OPEN state", () => {
    beforeEach(async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {
          // Expected
        }
      }
    });

    it("should fail fast when OPEN", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      await expect(breaker.execute(operation)).rejects.toThrow(
        "Circuit breaker 'test-breaker' is OPEN"
      );
      expect(operation).not.toHaveBeenCalled();
    });

    it("should transition to HALF_OPEN after reset timeout", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      // Advance time past reset timeout
      await vi.advanceTimersByTimeAsync(5001);

      // Should transition to HALF_OPEN and execute
      const result = await breaker.execute(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalled();
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it("should use fallback when circuit is open", async () => {
      const operation = vi.fn().mockResolvedValue("primary");
      const fallback = vi.fn().mockReturnValue("fallback");

      const result = await breaker.executeWithFallback(operation, fallback);

      expect(result).toBe("fallback");
      expect(operation).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe("HALF_OPEN state", () => {
    beforeEach(async () => {
      const operation = vi.fn().mockRejectedValue(new Error("failure"));
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch {
          // Expected
        }
      }
      // Advance time to allow transition to HALF_OPEN
      await vi.advanceTimersByTimeAsync(5001);
    });

    it("should transition to CLOSED after enough successes", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      // First success - still HALF_OPEN
      await breaker.execute(operation);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Second success - should close
      await breaker.execute(operation);
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should transition back to OPEN on failure", async () => {
      const successOperation = vi.fn().mockResolvedValue("success");
      const failOperation = vi.fn().mockRejectedValue(new Error("failure"));

      // First success - still HALF_OPEN
      await breaker.execute(successOperation);
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure - back to OPEN
      try {
        await breaker.execute(failOperation);
      } catch {
        // Expected
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe("state change callback", () => {
    it("should call onStateChange callback", async () => {
      const onStateChange = vi.fn();
      const breaker = new CircuitBreaker("test", {
        failureThreshold: 1,
        onStateChange,
      });

      const operation = vi.fn().mockRejectedValue(new Error("failure"));

      try {
        await breaker.execute(operation);
      } catch {
        // Expected
      }

      expect(onStateChange).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN);
    });
  });

  describe("manual controls", () => {
    it("should manually reset the circuit", () => {
      breaker.open();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
      expect(breaker.getStats().failures).toBe(0);
    });

    it("should manually open the circuit", () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      breaker.open();
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  afterEach(() => {
    CircuitBreakerRegistry.clear();
  });

  it("should create and retrieve breakers", () => {
    const breaker1 = CircuitBreakerRegistry.getBreaker("service1");
    const breaker2 = CircuitBreakerRegistry.getBreaker("service1");

    expect(breaker1).toBe(breaker2); // Same instance
  });

  it("should create different breakers for different names", () => {
    const breaker1 = CircuitBreakerRegistry.getBreaker("service1");
    const breaker2 = CircuitBreakerRegistry.getBreaker("service2");

    expect(breaker1).not.toBe(breaker2);
  });

  it("should get all breakers", () => {
    CircuitBreakerRegistry.getBreaker("service1");
    CircuitBreakerRegistry.getBreaker("service2");

    const all = CircuitBreakerRegistry.getAllBreakers();
    expect(all.size).toBe(2);
    expect(all.has("service1")).toBe(true);
    expect(all.has("service2")).toBe(true);
  });

  it("should reset all breakers", () => {
    const breaker1 = CircuitBreakerRegistry.getBreaker("service1");
    const breaker2 = CircuitBreakerRegistry.getBreaker("service2");

    breaker1.open();
    breaker2.open();

    CircuitBreakerRegistry.resetAll();

    expect(breaker1.getState()).toBe(CircuitState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitState.CLOSED);
  });

  it("should get stats for all breakers", () => {
    const breaker1 = CircuitBreakerRegistry.getBreaker("service1");
    const _breaker2 = CircuitBreakerRegistry.getBreaker("service2");

    breaker1.open();

    const stats = CircuitBreakerRegistry.getAllStats();

    expect(stats.service1.state).toBe(CircuitState.OPEN);
    expect(stats.service2.state).toBe(CircuitState.CLOSED);
  });

  it("should clear all breakers", () => {
    CircuitBreakerRegistry.getBreaker("service1");
    CircuitBreakerRegistry.getBreaker("service2");

    CircuitBreakerRegistry.clear();

    const all = CircuitBreakerRegistry.getAllBreakers();
    expect(all.size).toBe(0);
  });
});
