import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendErrorNotification } from "./email";
import { ErrorHandler } from "./error-handler";
import type { ILogger } from "./interfaces/logger";

// Mock the email module
vi.mock("./email", () => ({
  sendErrorNotification: vi.fn(),
}));

describe("ErrorHandler", () => {
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe("wrap()", () => {
    it("should return success result when operation succeeds", async () => {
      const operation = vi.fn().mockResolvedValue("test-data");

      const result = await ErrorHandler.wrap(operation);

      expect(result).toEqual({
        success: true,
        data: "test-data",
      });
    });

    it("should handle errors and return error result when not critical", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Test error"));

      const result = await ErrorHandler.wrap(operation, { critical: false });

      expect(result).toEqual({
        success: false,
        error: "Test error",
      });
    });

    it("should re-throw error when critical", async () => {
      const error = new Error("Critical error");
      const operation = vi.fn().mockRejectedValue(error);

      await expect(ErrorHandler.wrap(operation, { critical: true })).rejects.toThrow(
        "Critical error"
      );
    });

    it("should log errors when logger provided", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Log me"));

      await ErrorHandler.wrap(operation, {
        critical: false,
        logger: mockLogger,
        context: "test-op",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error in test-op:",
        "Log me",
        expect.any(Error)
      );
    });

    it("should send notification when requested", async () => {
      const error = new Error("Notify me");
      const operation = vi.fn().mockRejectedValue(error);

      await ErrorHandler.wrap(operation, {
        critical: false,
        notify: true,
      });

      expect(sendErrorNotification).toHaveBeenCalledWith(error);
    });
  });

  describe("retry()", () => {
    it("should retry failed operations", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("First fail"))
        .mockRejectedValueOnce(new Error("Second fail"))
        .mockResolvedValue("success");

      const result = await ErrorHandler.retry(operation, 3, 10);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should throw after max attempts", async () => {
      const error = new Error("Always fails");
      const operation = vi.fn().mockRejectedValue(error);

      await expect(ErrorHandler.retry(operation, 2, 10)).rejects.toThrow("Always fails");

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should apply exponential backoff", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValue("success");

      const start = Date.now();
      await ErrorHandler.retry(operation, 3, 100, 2, mockLogger);
      const elapsed = Date.now() - start;

      // Should wait at least 100ms (first retry delay)
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith("Retrying in 100ms...");
    });
  });

  describe("parallel()", () => {
    it("should execute operations in parallel", async () => {
      const op1 = vi.fn().mockResolvedValue("data1");
      const op2 = vi.fn().mockResolvedValue("data2");
      const op3 = vi.fn().mockResolvedValue("data3");

      const results = await ErrorHandler.parallel([op1, op2, op3]);

      expect(results).toEqual([
        { success: true, data: "data1" },
        { success: true, data: "data2" },
        { success: true, data: "data3" },
      ]);
    });

    it("should handle mixed success and failure", async () => {
      const op1 = vi.fn().mockResolvedValue("data1");
      const op2 = vi.fn().mockRejectedValue(new Error("Failed"));
      const op3 = vi.fn().mockResolvedValue("data3");

      const results = await ErrorHandler.parallel([op1, op2, op3]);

      expect(results).toEqual([
        { success: true, data: "data1" },
        { success: false, error: "Failed" },
        { success: true, data: "data3" },
      ]);
    });

    it("should stop on error when requested", async () => {
      const op1 = vi.fn().mockResolvedValue("data1");
      const op2 = vi.fn().mockRejectedValue(new Error("Stop here"));
      const op3 = vi.fn().mockResolvedValue("data3");

      const results = await ErrorHandler.parallel([op1, op2, op3], { stopOnError: true });

      expect(results).toEqual([
        { success: true, data: "data1" },
        { success: false, error: "Stop here" },
      ]);
      expect(op3).not.toHaveBeenCalled();
    });
  });

  describe("nonCritical()", () => {
    it("should return result on success", async () => {
      const operation = vi.fn().mockResolvedValue("data");

      const result = await ErrorHandler.nonCritical(operation);

      expect(result).toBe("data");
    });

    it("should return fallback on failure", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const result = await ErrorHandler.nonCritical(operation, "fallback");

      expect(result).toBe("fallback");
    });

    it("should return undefined on failure without fallback", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const result = await ErrorHandler.nonCritical(operation);

      expect(result).toBeUndefined();
    });

    it("should log debug message on failure", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Debug me"));

      await ErrorHandler.nonCritical(operation, undefined, mockLogger);

      expect(mockLogger.debug).toHaveBeenCalledWith("Non-critical operation failed:", "Debug me");
    });
  });

  describe("getErrorMessage()", () => {
    it("should extract message from Error", () => {
      const error = new Error("Test error");
      expect(ErrorHandler.getErrorMessage(error)).toBe("Test error");
    });

    it("should handle string errors", () => {
      expect(ErrorHandler.getErrorMessage("String error")).toBe("String error");
    });

    it("should handle objects with message property", () => {
      const error = { message: "Object error", code: 500 };
      expect(ErrorHandler.getErrorMessage(error)).toBe("Object error");
    });

    it("should handle unknown error types", () => {
      expect(ErrorHandler.getErrorMessage(null)).toBe("Unknown error");
      expect(ErrorHandler.getErrorMessage(undefined)).toBe("Unknown error");
      expect(ErrorHandler.getErrorMessage(123)).toBe("Unknown error");
    });
  });

  describe("createErrorReport()", () => {
    it("should create detailed error report", () => {
      const error = new Error("Test error");
      const report = ErrorHandler.createErrorReport(error, {
        operation: "test-op",
        timestamp: new Date("2024-01-01"),
        metadata: { userId: "123", action: "test" },
      });

      expect(report).toContain("Timestamp: 2024-01-01");
      expect(report).toContain("Operation: test-op");
      expect(report).toContain("Message: Test error");
      expect(report).toContain("Stack Trace:");
      expect(report).toContain('"userId": "123"');
    });
  });

  describe("isRetryable()", () => {
    it("should identify retryable errors", () => {
      expect(ErrorHandler.isRetryable(new Error("Connection timeout"))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error("ECONNREFUSED"))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error("Rate limit exceeded"))).toBe(true);
      expect(ErrorHandler.isRetryable(new Error("Service unavailable"))).toBe(true);
    });

    it("should identify non-retryable errors", () => {
      expect(ErrorHandler.isRetryable(new Error("Invalid input"))).toBe(false);
      expect(ErrorHandler.isRetryable(new Error("Unauthorized"))).toBe(false);
      expect(ErrorHandler.isRetryable(new Error("Not found"))).toBe(false);
    });
  });
});
