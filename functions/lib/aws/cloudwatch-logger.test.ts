import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudWatchLogger } from "./cloudwatch-logger";

describe("CloudWatchLogger", () => {
  let logger: CloudWatchLogger;

  beforeEach(() => {
    logger = new CloudWatchLogger("test-context");
    vi.clearAllMocks();
  });

  it("should log info messages with context", () => {
    const consoleSpy = vi.spyOn(console, "log");

    logger.info("Test message", { data: "test" });

    expect(consoleSpy).toHaveBeenCalledWith("[test-context] INFO:", "Test message", {
      data: "test",
    });
  });

  it("should log warn messages with context", () => {
    const consoleSpy = vi.spyOn(console, "warn");

    logger.warn("Warning message");

    expect(consoleSpy).toHaveBeenCalledWith("[test-context] WARN:", "Warning message");
  });

  it("should log error messages with context", () => {
    const consoleSpy = vi.spyOn(console, "error");
    const error = new Error("Test error");

    logger.error("Error occurred", error);

    expect(consoleSpy).toHaveBeenCalledWith("[test-context] ERROR:", "Error occurred", error);
  });

  it("should log debug messages with context", () => {
    const consoleSpy = vi.spyOn(console, "debug");

    logger.debug("Debug info", 123, "test");

    expect(consoleSpy).toHaveBeenCalledWith("[test-context] DEBUG:", "Debug info", 123, "test");
  });

  it("should handle multiple arguments", () => {
    const consoleSpy = vi.spyOn(console, "log");

    logger.info("Multiple", "args", { key: "value" }, [1, 2, 3]);

    expect(consoleSpy).toHaveBeenCalledWith(
      "[test-context] INFO:",
      "Multiple",
      "args",
      { key: "value" },
      [1, 2, 3]
    );
  });

  it("should use the provided context in all log levels", () => {
    const customLogger = new CloudWatchLogger("custom-service");
    const consoleSpy = vi.spyOn(console, "log");

    customLogger.info("Test");

    expect(consoleSpy).toHaveBeenCalledWith("[custom-service] INFO:", "Test");
  });
});
