import { expect, test } from "@playwright/test";
import { TestHelpers } from "./utils/test-helpers";

test.describe("Cleanup Mode Processing", () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);

    // Set up API mocks
    await helpers.mockGmailAPI();
    await helpers.mockOpenAIAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();
  });

  test("should process all unarchived emails in cleanup mode", async ({ request }) => {
    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 50,
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("batches");
    expect(result).toHaveProperty("totalProcessed");
    expect(result.batches).toBeGreaterThan(0);
    expect(result.totalProcessed).toBeGreaterThan(0);
  });

  test("should process emails in batches of 50", async ({ request }) => {
    // Mock 150 emails to test batching
    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 50,
        mockEmailCount: 150, // For testing
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.batches).toBe(3); // 150 emails / 50 per batch
    expect(result.totalProcessed).toBe(150);
    expect(result.digestsSent).toBe(3); // One digest per batch
  });

  test("should handle batch delays correctly", async ({ request }) => {
    const startTime = Date.now();

    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 50,
        mockEmailCount: 100, // 2 batches
        batchDelayMs: 5000, // 5 second delay
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status()).toBe(200);

    // Should take at least 5 seconds for the delay between 2 batches
    expect(duration).toBeGreaterThanOrEqual(5000);

    const result = await response.json();
    expect(result.batches).toBe(2);
  });

  test("should use async invocation for cleanup mode", async ({ request }) => {
    const response = await request.post("/api/digest/trigger-cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
      },
    });

    // Should return immediately with 202 Accepted
    expect(response.status()).toBe(202);

    const result = await response.json();
    expect(result).toHaveProperty("message");
    expect(result.message).toContain("async");
    expect(result).toHaveProperty("invocationId");
  });

  test("should send separate digest per batch", async ({ request }) => {
    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 30,
        mockEmailCount: 90, // 3 batches
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.digestsSent).toBe(3);

    // Each digest should have batch info
    expect(result.digests).toHaveLength(3);
    result.digests.forEach((digest: any, index: number) => {
      expect(digest).toHaveProperty("batchNumber", index + 1);
      expect(digest).toHaveProperty("emailCount", 30);
      expect(digest).toHaveProperty("sentAt");
    });
  });

  test("should archive emails after processing in cleanup", async ({ request }) => {
    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 50,
        mockEmailCount: 50,
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result).toHaveProperty("archivedCount");
    expect(result.archivedCount).toBe(50);
  });

  test("should handle cleanup mode timeout gracefully", async ({ request }) => {
    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 1000, // Large batch to potentially timeout
        mockEmailCount: 5000,
        timeout: 10000, // 10 second timeout for test
      },
    });

    const result = await response.json();

    // Should handle timeout gracefully
    if (!result.success) {
      expect(result.error).toContain("timeout");
      expect(result).toHaveProperty("processedBeforeTimeout");
    }
  });

  test("should measure cleanup mode performance", async ({ request }) => {
    const metrics = await helpers.measurePerformance(async () => {
      await request.post("/api/digest/cleanup", {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_KEY || "test-key",
        },
        data: {
          cleanup: true,
          batchSize: 50,
          mockEmailCount: 200,
        },
      });
    });

    expect(metrics.duration).toBeLessThan(900000); // 15 minutes max
    expect(metrics.memoryUsed).toBeLessThan(1024); // 1GB max

    console.log("Cleanup mode performance:", {
      duration: `${metrics.duration}ms`,
      memory: `${metrics.memoryUsed.toFixed(2)}MB`,
    });
  });

  test("should track cleanup progress", async ({ request }) => {
    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 25,
        mockEmailCount: 100,
        trackProgress: true,
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result).toHaveProperty("progress");
    expect(result.progress).toHaveLength(4); // 4 batches of 25

    result.progress.forEach((batch: any, index: number) => {
      expect(batch).toHaveProperty("batchNumber", index + 1);
      expect(batch).toHaveProperty("processed", 25);
      expect(batch).toHaveProperty("startTime");
      expect(batch).toHaveProperty("endTime");
      expect(batch).toHaveProperty("duration");
    });
  });
});
