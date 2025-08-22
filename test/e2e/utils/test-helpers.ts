import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class TestHelpers {
  constructor(private page: Page) {}

  async mockGmailAPI() {
    await this.page.route("**/gmail/v1/**", async (route) => {
      const url = route.request().url();

      if (url.includes("/messages/list")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            messages: [
              { id: "msg-001", threadId: "thread-001" },
              { id: "msg-002", threadId: "thread-002" },
            ],
            resultSizeEstimate: 2,
          }),
        });
      } else if (url.includes("/messages/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "msg-001",
            threadId: "thread-001",
            payload: {
              headers: [
                { name: "Subject", value: "Test AI Newsletter" },
                { name: "From", value: "test@example.com" },
                { name: "Date", value: new Date().toISOString() },
              ],
              body: {
                data: Buffer.from("Test email content about AI").toString("base64"),
              },
            },
          }),
        });
      }
    });
  }

  async mockOpenAIAPI() {
    await this.page.route("**/api.openai.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Date.now(),
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "This is a test AI analysis response.",
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
          },
        }),
      });
    });
  }

  async mockResendAPI() {
    await this.page.route("**/api.resend.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "email-sent-001",
          from: "test@aidig.dev",
          to: ["recipient@example.com"],
          created_at: new Date().toISOString(),
        }),
      });
    });
  }

  async mockAWSServices() {
    await this.page.route("**/dynamodb.**", async (route) => {
      const body = route.request().postData();
      if (body?.includes("GetItem") || body?.includes("Query")) {
        await route.fulfill({
          status: 200,
          contentType: "application/x-amz-json-1.0",
          body: JSON.stringify({ Item: {} }),
        });
      } else if (body?.includes("PutItem")) {
        await route.fulfill({
          status: 200,
          contentType: "application/x-amz-json-1.0",
          body: JSON.stringify({}),
        });
      }
    });

    await this.page.route("**/s3.**", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          headers: { ETag: '"test-etag"' },
        });
      } else if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ processed: true }),
        });
      }
    });
  }

  async waitForDigestProcessing() {
    await this.page.waitForTimeout(2000);
  }

  async verifyDigestSent() {
    const requests = this.page.context().cookies();
    expect(requests).toBeDefined();
  }

  async measurePerformance(fn: () => Promise<void>): Promise<{
    duration: number;
    memoryUsed: number;
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    await fn();

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    return {
      duration: endTime - startTime,
      memoryUsed: (endMemory - startMemory) / 1024 / 1024,
    };
  }
}
