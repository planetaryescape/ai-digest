import { test, expect } from "@playwright/test";
import { TestHelpers } from "./utils/test-helpers";
import { testConfig } from "./fixtures/test-data";

test.describe("Weekly Digest Flow", () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);

    // Set up API mocks
    await helpers.mockGmailAPI();
    await helpers.mockOpenAIAPI();
    await helpers.mockResendAPI();
    await helpers.mockAWSServices();
  });

  test("should process weekly digest end-to-end", async ({ page, request }) => {
    // Simulate triggering the weekly digest
    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        mode: "weekly",
        dryRun: false,
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("emailsProcessed");
    expect(result).toHaveProperty("digestSent");
    expect(result.emailsProcessed).toBeGreaterThan(0);
    expect(result.digestSent).toBe(true);

    // Verify metrics were recorded
    expect(result).toHaveProperty("metrics");
    expect(result.metrics).toHaveProperty("processingTime");
    expect(result.metrics).toHaveProperty("totalCost");
    expect(result.metrics.totalCost).toBeLessThan(testConfig.costLimits.maxCostPerRun);
  });

  test("should fetch emails from Gmail API", async ({ page, request }) => {
    const response = await request.get("/api/digest/fetch-emails", {
      headers: {
        "x-api-key": process.env.API_KEY || "test-key",
      },
      params: {
        days: "7",
      },
    });

    expect(response.status()).toBe(200);

    const emails = await response.json();
    expect(Array.isArray(emails)).toBe(true);
    expect(emails.length).toBeGreaterThan(0);

    // Verify email structure
    const firstEmail = emails[0];
    expect(firstEmail).toHaveProperty("id");
    expect(firstEmail).toHaveProperty("subject");
    expect(firstEmail).toHaveProperty("from");
    expect(firstEmail).toHaveProperty("receivedDate");
  });

  test("should classify emails as AI-related", async ({ page, request }) => {
    const testEmails = [
      { subject: "Latest GPT-5 Updates", body: "OpenAI announces..." },
      { subject: "Regular Newsletter", body: "Nothing about AI here..." },
    ];

    const response = await request.post("/api/digest/classify", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { emails: testEmails },
    });

    expect(response.status()).toBe(200);

    const classified = await response.json();
    expect(classified).toHaveProperty("aiEmails");
    expect(classified).toHaveProperty("nonAiEmails");
    expect(classified.aiEmails.length).toBeGreaterThan(0);
  });

  test("should generate and send digest email", async ({ page, request }) => {
    const response = await request.post("/api/digest/send", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        recipient: testConfig.resend.to,
        content: {
          summary: "Weekly AI Digest",
          articles: [{ title: "GPT-5 Released", summary: "Major breakthrough..." }],
        },
      },
    });

    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result).toHaveProperty("emailId");
    expect(result).toHaveProperty("sent", true);
  });

  test("should track processed emails in storage", async ({ page, request }) => {
    // Process a digest
    await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: { mode: "weekly" },
    });

    // Check storage for tracking
    const storageResponse = await request.get("/api/digest/processed", {
      headers: {
        "x-api-key": process.env.API_KEY || "test-key",
      },
    });

    expect(storageResponse.status()).toBe(200);

    const processed = await storageResponse.json();
    expect(processed).toHaveProperty("emailIds");
    expect(Array.isArray(processed.emailIds)).toBe(true);
    expect(processed.emailIds.length).toBeGreaterThan(0);
  });

  test("should respect cost limits", async ({ page, request }) => {
    const response = await request.post("/api/digest/weekly", {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "test-key",
      },
      data: {
        mode: "weekly",
        maxCost: 0.01, // Very low limit to test
      },
    });

    const result = await response.json();

    // Should either succeed with low cost or fail gracefully
    if (result.success) {
      expect(result.metrics.totalCost).toBeLessThanOrEqual(0.01);
    } else {
      expect(result.error).toContain("cost limit");
    }
  });

  test("should handle rate limiting gracefully", async ({ page, request }) => {
    // Send multiple requests rapidly
    const promises = Array(5)
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

    const responses = await Promise.all(promises);

    // At least one should succeed
    const successCount = responses.filter((r) => r.status() === 200).length;
    expect(successCount).toBeGreaterThan(0);

    // Rate limited ones should return 429
    const rateLimited = responses.filter((r) => r.status() === 429);
    if (rateLimited.length > 0) {
      const body = await rateLimited[0].json();
      expect(body).toHaveProperty("error");
      expect(body.error).toContain("rate");
    }
  });

  test("should measure weekly digest performance", async ({ page, request }) => {
    const metrics = await helpers.measurePerformance(async () => {
      await request.post("/api/digest/weekly", {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.API_KEY || "test-key",
        },
        data: { mode: "weekly" },
      });
    });

    expect(metrics.duration).toBeLessThan(120000); // 2 minutes max
    expect(metrics.memoryUsed).toBeLessThan(512); // 512 MB max

    console.log("Weekly digest performance:", {
      duration: `${metrics.duration}ms`,
      memory: `${metrics.memoryUsed.toFixed(2)}MB`,
    });
  });
});
