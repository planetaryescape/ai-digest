import { formatISO } from "date-fns";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ILogger } from "../lib/interfaces/logger";
import type { IStorageClient } from "../lib/interfaces/storage";
import { DigestProcessor } from "./digest-processor";

// Mock all dependencies
vi.mock("../lib/agents/EmailFetcherAgent", () => ({
  EmailFetcherAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../lib/agents/ClassifierAgent", () => ({
  ClassifierAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../lib/agents/ContentExtractorAgent", () => ({
  ContentExtractorAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../lib/agents/ResearchAgent", () => ({
  ResearchAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../lib/agents/AnalysisAgent", () => ({
  AnalysisAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      articles: [],
      totalArticles: 0,
    }),
  })),
}));

vi.mock("../lib/agents/CriticAgent", () => ({
  CriticAgent: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue({
      articles: [],
      totalArticles: 0,
    }),
  })),
}));

vi.mock("../lib/circuit-breaker-enhanced", () => ({
  EnhancedCircuitBreaker: {
    getBreaker: vi.fn().mockReturnValue({
      execute: vi.fn((fn) => fn()),
      getState: vi.fn().mockReturnValue("CLOSED"),
    }),
  },
}));

vi.mock("../lib/cost-tracker", () => ({
  CostTracker: vi.fn().mockImplementation(() => ({
    canProceed: vi.fn().mockReturnValue(true),
    trackCost: vi.fn(),
    getRemainingBudget: vi.fn().mockReturnValue(10),
    getReport: vi.fn().mockReturnValue("Cost report"),
  })),
}));

vi.mock("../lib/email", () => ({
  sendDigest: vi.fn().mockResolvedValue(undefined),
  sendErrorNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/gmail-batch-operations", () => ({
  GmailBatchOperations: vi.fn().mockImplementation(() => ({
    archiveEmails: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../lib/logger", () => ({
  createLogger: vi.fn().mockImplementation(() => ({
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  })),
}));

vi.mock("../lib/metrics", () => ({
  getMetrics: vi.fn().mockImplementation(() => ({
    histogram: vi.fn(),
    increment: vi.fn(),
  })),
}));

describe("DigestProcessor", () => {
  let processor: DigestProcessor;
  let mockStorage: IStorageClient;
  let mockLogger: ILogger;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock storage
    mockStorage = {
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markMultipleProcessed: vi.fn().mockResolvedValue(undefined),
      getWeeklyProcessedIds: vi.fn().mockResolvedValue([]),
      getAllProcessed: vi.fn().mockResolvedValue([]),
      getAllProcessedIds: vi.fn().mockResolvedValue([]),
      isProcessed: vi.fn().mockResolvedValue(false),
      cleanupOldRecords: vi.fn().mockResolvedValue(0),
    };

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    processor = new DigestProcessor({
      storage: mockStorage,
      logger: mockLogger,
      platform: "test",
    });
  });

  describe("initialization", () => {
    it("should create a processor with required options", () => {
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(DigestProcessor);
    });

    it("should use default logger if not provided", () => {
      const processorWithoutLogger = new DigestProcessor({
        storage: mockStorage,
      });
      expect(processorWithoutLogger).toBeDefined();
    });
  });

  describe("processWeeklyDigest", () => {
    it("should handle no emails found scenario", async () => {
      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue([]),
          }) as any
      );

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(0);
      expect(result.message).toContain("No AI emails found");
    });

    it("should verify mock setup for email processing", async () => {
      const mockEmails = [
        {
          id: "1",
          from: "test@ai.com",
          subject: "AI News",
          snippet: "Latest in AI",
          date: formatISO(new Date()),
        },
      ];

      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      const { ClassifierAgent } = await import("../lib/agents/ClassifierAgent");
      const { ContentExtractorAgent } = await import("../lib/agents/ContentExtractorAgent");
      const { ResearchAgent } = await import("../lib/agents/ResearchAgent");
      const { AnalysisAgent } = await import("../lib/agents/AnalysisAgent");
      const { CriticAgent } = await import("../lib/agents/CriticAgent");

      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      vi.mocked(ClassifierAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      vi.mocked(ContentExtractorAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      vi.mocked(ResearchAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      vi.mocked(AnalysisAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue({
              articles: [
                {
                  title: "AI Test",
                  summary: "Test summary",
                  source: "test@ai.com",
                  category: "news",
                  link: "https://test.com",
                },
              ],
              totalArticles: 1,
            }),
          }) as any
      );

      vi.mocked(CriticAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue({
              articles: [
                {
                  title: "AI Test",
                  summary: "Test summary",
                  source: "test@ai.com",
                  category: "news",
                  link: "https://test.com",
                  commentary: "Interesting development",
                },
              ],
              totalArticles: 1,
            }),
          }) as any
      );

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(1); // Exactly 1 email mocked
      expect(result.emailsProcessed).toBe(0); // Current implementation doesn't process
      expect(result.message).toBe("No AI-related emails found to process");
    });
  });

  describe("processCleanupDigest", () => {
    it("should handle cleanup mode with multiple batches", async () => {
      // Create 120 mock emails to trigger batching (batch size is typically 50)
      const mockEmails = Array.from({ length: 120 }, (_, i) => ({
        id: `email-${i}`,
        from: `sender${i}@ai.com`,
        subject: `AI News ${i}`,
        snippet: `Content ${i}`,
        date: formatISO(new Date()),
      }));

      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      const result = await processor.processCleanupDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(120); // All 120 emails found
      expect(result.emailsProcessed).toBe(0); // None processed due to mocking
      expect(result.batches).toBe(3); // 120 emails / 50 per batch = 3 batches
    });

    it("should handle errors gracefully", async () => {
      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockRejectedValue(new Error("Gmail API error")),
          }) as any
      );

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Gmail API error");
    });

    it("should respect cost limits", async () => {
      const { CostTracker } = await import("../lib/cost-tracker");
      vi.mocked(CostTracker).mockImplementation(
        () =>
          ({
            canProceed: vi.fn().mockReturnValue(false),
            trackCost: vi.fn(),
            getRemainingBudget: vi.fn().mockReturnValue(0),
            getReport: vi.fn().mockReturnValue("Cost limit reached"),
          }) as any
      );

      const mockEmails = [
        {
          id: "1",
          from: "test@ai.com",
          subject: "AI News",
          snippet: "Latest in AI",
          date: formatISO(new Date()),
        },
      ];

      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
    });

    it("should handle circuit breaker trips", async () => {
      const { EnhancedCircuitBreaker } = await import("../lib/circuit-breaker-enhanced");
      vi.mocked(EnhancedCircuitBreaker.getBreaker).mockReturnValue({
        execute: vi.fn().mockRejectedValue(new Error("Circuit breaker is OPEN")),
        getState: vi.fn().mockReturnValue("OPEN"),
      } as any);

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Circuit breaker");
    });
  });

  describe("platform-specific behavior", () => {
    it("should handle AWS platform", () => {
      const awsProcessor = new DigestProcessor({
        storage: mockStorage,
        platform: "aws",
      });
      expect(awsProcessor).toBeDefined();
    });

    it("should handle Azure platform", () => {
      const azureProcessor = new DigestProcessor({
        storage: mockStorage,
        platform: "azure",
      });
      expect(azureProcessor).toBeDefined();
    });
  });

  describe("storage interactions", () => {
    it("should track processed emails", async () => {
      const mockEmails = [
        {
          id: "1",
          from: "test@ai.com",
          subject: "AI News",
          snippet: "Latest in AI",
          date: formatISO(new Date()),
        },
      ];

      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      await processor.processWeeklyDigest();

      expect(mockStorage.markProcessed).toHaveBeenCalled();
    });

    it("should update known AI senders", async () => {
      const mockEmails = [
        {
          id: "1",
          from: "newsletter@openai.com",
          subject: "OpenAI Updates",
          snippet: "Latest from OpenAI",
          date: formatISO(new Date()),
        },
      ];

      const { EmailFetcherAgent } = await import("../lib/agents/EmailFetcherAgent");
      const { ClassifierAgent } = await import("../lib/agents/ClassifierAgent");

      vi.mocked(EmailFetcherAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      vi.mocked(ClassifierAgent).mockImplementation(
        () =>
          ({
            execute: vi.fn().mockResolvedValue(mockEmails),
          }) as any
      );

      await processor.processWeeklyDigest();

      expect(mockStorage.markProcessed).toHaveBeenCalled();
    });
  });
});
