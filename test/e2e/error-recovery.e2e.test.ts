import { expect, test } from "@playwright/test";
import { TestHelpers } from "./utils/test-helpers";

test.describe("Error Recovery Scenarios", () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
  });

  test("should handle Gmail API failure gracefully", async ({ page, request }) => {
    // Mock Gmail API to return error
    await page.route("**/gmail/v1/**", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: 503,
            message: "Service Unavailable",
          },
        }),
      });
    });

    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { mode: "weekly" },
    });

    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toContain("Gmail");
    expect(result).toHaveProperty("retryAfter");
  });

  test("should retry failed OpenAI requests", async ({ page, request }) => {
    let attemptCount = 0;

    // Mock OpenAI to fail first 2 times, succeed on 3rd
    await page.route("**/api.openai.com/**", async (route) => {
      attemptCount++;
      if (attemptCount < 3) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              message: "Rate limit exceeded",
              type: "rate_limit_error",
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "chatcmpl-test",
            choices: [
              {
                message: { content: "Success after retry" },
              },
            ],
          }),
        });
      }
    });

    await helpers.mockGmailAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();

    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { mode: "weekly" },
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(attemptCount).toBe(3);
  });

  test("should activate circuit breaker after multiple failures", async ({ page, request }) => {
    // Mock OpenAI to always fail
    await page.route("**/api.openai.com/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: "Internal Server Error" },
        }),
      });
    });

    await helpers.mockGmailAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();

    // Make multiple requests to trigger circuit breaker
    const requests = Array(5)
      .fill(null)
      .map(() =>
        request.post("/api/digest/weekly", {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.API_KEY || "test-key",
          },
          data: { mode: "weekly" },
        })
      );

    const responses = await Promise.all(requests);

    // Last requests should fail fast due to circuit breaker
    const lastResponse = responses[responses.length - 1];
    const result = await lastResponse.json();

    expect(result.success).toBe(false);
    expect(result.error).toContain("circuit breaker");
    expect(result).toHaveProperty("circuitState", "open");
  });

  test("should handle storage failures with fallback", async ({ page, request }) => {
    // Mock DynamoDB to fail
    await page.route("**/dynamodb.**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/x-amz-json-1.0",
        body: JSON.stringify({
          __type: "InternalServerError",
          message: "DynamoDB unavailable",
        }),
      });
    });

    // Mock S3 as fallback
    await page.route("**/s3.**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { ETag: '"fallback-etag"' },
      });
    });

    await helpers.mockGmailAPI();
    await helpers.mockOpenAIAPI();
    await helpers.mockResendAPI();

    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { mode: "weekly" },
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("storageFallback", true);
    expect(result).toHaveProperty("fallbackStorage", "s3");
  });

  test("should handle email send failures gracefully", async ({ page, request }) => {
    await helpers.mockGmailAPI();
    await helpers.mockOpenAIAPI();
    await helpers.mockAWSServices();

    // Mock Resend to fail
    await page.route("**/api.resend.com/**", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          name: "validation_error",
          message: "Invalid email address",
        }),
      });
    });

    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { mode: "weekly" },
    });

    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toContain("email");
    expect(result).toHaveProperty("processingCompleted", true);
    expect(result).toHaveProperty("emailSent", false);
  });

  test("should handle partial batch failures in cleanup mode", async ({ page, request }) => {
    let batchCount = 0;

    // Mock to fail on 2nd batch
    await page.route("**/api.openai.com/**", async (route) => {
      batchCount++;
      if (batchCount === 2) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { message: "Batch 2 failed" },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            choices: [{ message: { content: "Success" } }],
          }),
        });
      }
    });

    await helpers.mockGmailAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();

    const response = await request.post("/api/digest/cleanup", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        cleanup: true,
        batchSize: 25,
        mockEmailCount: 75, // 3 batches
      },
    });

    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result).toHaveProperty("partialSuccess", true);
    expect(result).toHaveProperty("successfulBatches", 2);
    expect(result).toHaveProperty("failedBatches", 1);
    expect(result).toHaveProperty("totalProcessed", 50); // 2 successful batches
  });

  test("should recover from temporary network issues", async ({ page, request }) => {
    let requestCount = 0;

    // Simulate network issues for first request
    await page.route("**/*", async (route, request) => {
      requestCount++;
      if (requestCount === 1 && request.url().includes("gmail")) {
        await route.abort("connectionfailed");
      } else {
        await route.continue();
      }
    });

    // Set up normal mocks for retry
    await helpers.mockGmailAPI();
    await helpers.mockOpenAIAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();

    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { mode: "weekly", retryOnNetworkError: true },
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty("retriesUsed");
    expect(result.retriesUsed).toBeGreaterThan(0);
  });

  test("should handle cost limit exceeded gracefully", async ({ page, request }) => {
    // Mock OpenAI to return high token usage
    await page.route("**/api.openai.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "chatcmpl-test",
          choices: [
            {
              message: { content: "Expensive response" },
            },
          ],
          usage: {
            prompt_tokens: 10000,
            completion_tokens: 5000,
            total_tokens: 15000,
          },
        }),
      });
    });

    await helpers.mockGmailAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();

    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        mode: "weekly",
        maxCost: 0.01, // Very low limit
      },
    });

    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toContain("cost limit");
    expect(result).toHaveProperty("costAtFailure");
    expect(result.costAtFailure).toBeGreaterThan(0.01);
  });

  test("should handle Lambda timeout with cleanup", async ({ request }) => {
    const response = await request.post("/api/digest/timeout-test", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        simulateTimeout: true,
        timeoutMs: 5000,
      },
    });

    const result = await response.json();

    // Should handle timeout gracefully
    expect(result).toHaveProperty("timedOut", true);
    expect(result).toHaveProperty("cleanupPerformed", true);
    expect(result).toHaveProperty("partialResults");
  });
});
