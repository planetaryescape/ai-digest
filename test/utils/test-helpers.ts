import { vi } from "vitest";
import type { ILogger } from "../../functions/lib/interfaces/logger";
import type { IStorageClient } from "../../functions/lib/interfaces/storage";
import type { DigestOutput } from "../../functions/lib/schemas/digest";
import type { EmailItem, ProcessedEmail, Summary } from "../../functions/lib/types";

// Mock logger implementation
export class MockLogger implements ILogger {
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  debug = vi.fn();
}

// Mock storage implementation
export class MockStorageClient implements IStorageClient {
  private processedEmails = new Map<string, ProcessedEmail>();

  markProcessed = vi.fn(async (emailId: string, subject: string) => {
    this.processedEmails.set(emailId, {
      emailId,
      subject,
      processedAt: new Date().toISOString(),
    });
  });

  markMultipleProcessed = vi.fn(async (emails: Array<{ id: string; subject: string }>) => {
    for (const email of emails) {
      await this.markProcessed(email.id, email.subject);
    }
  });

  getWeeklyProcessedIds = vi.fn(async () => {
    return Array.from(this.processedEmails.keys());
  });

  getAllProcessed = vi.fn(async () => {
    return Array.from(this.processedEmails.values());
  });

  getAllProcessedIds = vi.fn(async () => {
    return Array.from(this.processedEmails.keys());
  });

  isProcessed = vi.fn(async (emailId: string) => {
    return this.processedEmails.has(emailId);
  });

  cleanupOldRecords = vi.fn(async (daysToKeep: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;
    for (const [id, email] of this.processedEmails.entries()) {
      if (new Date(email.processedAt) < cutoffDate) {
        this.processedEmails.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  });
}

// Test data factories
export const createMockEmailItem = (overrides?: Partial<EmailItem>): EmailItem => ({
  id: "email-123",
  subject: "AI Newsletter: Latest Updates",
  sender: "newsletter@ai-company.com",
  date: new Date().toISOString(),
  articles: [
    {
      url: "https://example.com/article1",
      title: "New AI Model Released",
      desc: "A breakthrough in language models",
      snippet: "Researchers have developed...",
    },
  ],
  ...overrides,
});

export const createMockDigestOutput = (overrides?: Partial<DigestOutput>): DigestOutput => ({
  headline: "Major AI Breakthroughs This Week",
  summary: "Several significant developments in AI were announced.",
  whatHappened: [
    {
      title: "OpenAI Releases GPT-5",
      source: "OpenAI Blog",
      description: "New model with improved capabilities",
      category: "product",
    },
  ],
  takeaways: [
    {
      category: "technical",
      title: "Try the new API",
      description: "New features available for testing",
      actionable: true,
    },
  ],
  rolePlays: [],
  productPlays: [],
  tools: [
    {
      name: "GPT-5 API",
      category: "api",
      description: "Latest language model API",
      useCase: "Build advanced AI applications",
      link: "https://api.openai.com",
    },
  ],
  shortMessage: "GPT-5 launched. Try the API.",
  keyThemes: ["AI advancement", "API improvements"],
  ...overrides,
});

export const createMockSummary = (overrides?: Partial<Summary>): Summary => ({
  digest: createMockDigestOutput(),
  message: "Weekly AI digest processed successfully",
  items: [createMockEmailItem()],
  generatedAt: new Date().toISOString(),
  ...overrides,
});

// Helper to wait for async operations
export const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

// Helper to create a mock Gmail client
export const createMockGmailClient = () => ({
  getWeeklyAIEmails: vi.fn().mockResolvedValue([createMockEmailItem()]),
  getAllAIEmails: vi.fn().mockResolvedValue([createMockEmailItem()]),
  archiveOldEmails: vi.fn().mockResolvedValue(5),
  archiveMessages: vi.fn().mockResolvedValue(undefined),
  getSenderTracker: vi.fn().mockReturnValue({
    addMultipleConfirmedSenders: vi.fn().mockResolvedValue(undefined),
    isKnownAISender: vi.fn().mockResolvedValue(false),
  }),
});

// Helper to create a mock email module
export const createMockEmailModule = () => ({
  sendDigest: vi.fn().mockResolvedValue(undefined),
  sendErrorNotification: vi.fn().mockResolvedValue(undefined),
});

// Helper to create a mock summarizer
export const createMockSummarizer = () => vi.fn().mockResolvedValue(createMockSummary());
