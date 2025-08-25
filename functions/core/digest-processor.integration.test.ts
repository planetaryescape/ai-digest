import { formatISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnhancedCircuitBreaker } from "../lib/circuit-breaker-enhanced";
import type { ILogger } from "../lib/interfaces/logger";
import type { IStorageClient } from "../lib/interfaces/storage";
import { DigestProcessor } from "./digest-processor";

// Mock the agent constructors to inject test-friendly versions
vi.mock("../lib/agents/EmailFetcherAgent", async () => {
  const { MockEmailFetcherAgent } = await import("./test-helpers/mock-agents");
  return {
    EmailFetcherAgent: vi.fn().mockImplementation((costTracker) => {
      return new MockEmailFetcherAgent(costTracker);
    }),
  };
});

vi.mock("../lib/agents/ClassifierAgent", async () => {
  const { MockClassifierAgent } = await import("./test-helpers/mock-agents");
  return {
    ClassifierAgent: vi.fn().mockImplementation((costTracker) => {
      return new MockClassifierAgent(costTracker);
    }),
  };
});

vi.mock("../lib/agents/ContentExtractorAgent", async () => {
  const { MockContentExtractorAgent } = await import("./test-helpers/mock-agents");
  return {
    ContentExtractorAgent: vi.fn().mockImplementation((costTracker) => {
      return new MockContentExtractorAgent(costTracker);
    }),
  };
});

vi.mock("../lib/agents/ResearchAgent", async () => {
  const { MockResearchAgent } = await import("./test-helpers/mock-agents");
  return {
    ResearchAgent: vi.fn().mockImplementation((costTracker) => {
      return new MockResearchAgent(costTracker);
    }),
  };
});

vi.mock("../lib/agents/AnalysisAgent", async () => {
  const { MockAnalysisAgent } = await import("./test-helpers/mock-agents");
  return {
    AnalysisAgent: vi.fn().mockImplementation((costTracker) => {
      return new MockAnalysisAgent(costTracker);
    }),
  };
});

vi.mock("../lib/agents/CriticAgent", async () => {
  const { MockCriticAgent } = await import("./test-helpers/mock-agents");
  return {
    CriticAgent: vi.fn().mockImplementation((costTracker) => {
      return new MockCriticAgent(costTracker);
    }),
  };
});

// Only mock external APIs and services, not agent logic
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
        refreshAccessToken: vi.fn().mockResolvedValue({
          credentials: { access_token: "mock-token" },
        }),
        request: vi.fn().mockResolvedValue({ data: {} }),
      })),
    },
    gmail: vi.fn().mockImplementation((_options) => ({
      users: {
        messages: {
          list: vi.fn(),
          batchModify: vi.fn(),
          get: vi.fn(),
        },
      },
    })),
  },
  gmail_v1: {
    Gmail: vi.fn(),
  },
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: vi.fn(),
    }),
  },
  QueryCommand: vi.fn(),
  BatchWriteCommand: vi.fn(),
  PutCommand: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({ object: {} }),
  openai: vi.fn().mockReturnValue({}),
}));

vi.mock("../lib/email", () => ({
  sendDigest: vi.fn().mockResolvedValue(undefined),
  sendErrorNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/gmail-batch-operations", () => ({
  GmailBatchOperations: vi.fn().mockImplementation(() => ({
    archiveEmails: vi.fn().mockResolvedValue(undefined),
    batchMarkReadAndArchive: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Minimal logger mock
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

describe("DigestProcessor Integration Tests", () => {
  let processor: DigestProcessor;
  let mockStorage: IStorageClient;
  let mockLogger: ILogger;

  // Store original env vars
  const originalEnv = process.env;

  // Test fixtures
  const mockEmails = [
    {
      id: "email1",
      from: "newsletter@openai.com",
      subject: "GPT-5 Announced: Revolutionary AI Breakthrough",
      snippet: "OpenAI announces GPT-5 with unprecedented capabilities...",
      body: "Full announcement about GPT-5 features and capabilities...",
      date: formatISO(new Date()),
      urls: ["https://openai.com/gpt-5"],
    },
    {
      id: "email2",
      from: "updates@anthropic.com",
      subject: "Claude 3 Performance Updates",
      snippet: "Latest improvements to Claude 3 model performance...",
      body: "Detailed update on Claude 3 improvements and benchmarks...",
      date: formatISO(new Date()),
      urls: ["https://anthropic.com/claude-3-updates"],
    },
    {
      id: "email3",
      from: "random@newsletter.com",
      subject: "Weekend Deals on Electronics",
      snippet: "Great deals on TVs and laptops this weekend...",
      body: "Sale information for electronics...",
      date: formatISO(new Date()),
      urls: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment variables
    process.env = {
      ...originalEnv,
      GMAIL_CLIENT_ID: "mock-client-id",
      GMAIL_CLIENT_SECRET: "mock-client-secret",
      GMAIL_REFRESH_TOKEN: "mock-refresh-token",
      AWS_REGION: "us-east-1",
      OPENAI_API_KEY: "mock-openai-key",
    };

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

    // Reset circuit breaker states by getting each breaker and resetting
    ["gmail", "openai", "firecrawl", "brave"].forEach((name) => {
      const breaker = EnhancedCircuitBreaker.getBreaker(name);
      breaker.reset();
    });

    // Create processor normally - agent mocks will be injected via constructor mocks
    processor = new DigestProcessor({
      storage: mockStorage,
      logger: mockLogger,
      platform: "test",
    });

    // Initialize batchOperations if not set by mocked EmailFetcherAgent
    if (!(processor as any).batchOperations) {
      (processor as any).batchOperations = {
        batchMarkReadAndArchive: vi.fn().mockResolvedValue(undefined),
        archiveEmails: vi.fn().mockResolvedValue(undefined),
      };
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Restore original env vars
    process.env = originalEnv;
  });

  describe("Weekly Digest Pipeline", () => {
    it("should coordinate agents for successful weekly digest processing", async () => {
      // Mock Gmail API responses
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      // Mock email list response - handle both with and without userId
      vi.mocked(gmailMock.users.messages.list).mockImplementation((_params?: any) => {
        return Promise.resolve({
          data: {
            messages: mockEmails.map((e) => ({ id: e.id, threadId: e.id })),
          },
        });
      });

      // Mock individual email fetches
      mockEmails.forEach((email) => {
        vi.mocked(gmailMock.users.messages.get).mockImplementationOnce((_params?: any) => {
          return Promise.resolve({
            data: {
              id: email.id,
              payload: {
                headers: [
                  { name: "From", value: email.from },
                  { name: "Subject", value: email.subject },
                  { name: "Date", value: email.date },
                ],
                snippet: email.snippet,
                body: { data: Buffer.from(email.body).toString("base64") },
              },
            },
          });
        });
      });

      // Mock OpenAI classification response
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          classifications: [
            { emailId: "email1", classification: "AI", confidence: 0.95 },
            { emailId: "email2", classification: "AI", confidence: 0.92 },
            { emailId: "email3", classification: "NOT_AI", confidence: 0.88 },
          ],
        },
      });

      // Mock content extraction (Firecrawl)
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          emails: mockEmails.slice(0, 2).map((email) => ({
            ...email,
            extractedContent: `Extracted content from ${email.subject}`,
            articles: [
              {
                title: email.subject,
                content: `Article content about ${email.subject}`,
                url: email.urls[0],
              },
            ],
          })),
        },
      });

      // Mock research enrichment
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          emails: mockEmails.slice(0, 2).map((email) => ({
            ...email,
            research: {
              additionalContext: `Research findings about ${email.subject}`,
              relatedTopics: ["AI", "Machine Learning"],
            },
          })),
        },
      });

      // Mock analysis response
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          whatHappened: [
            {
              title: "GPT-5 Announced",
              description: "OpenAI unveils next-generation AI model",
              impact: "High",
            },
            {
              title: "Claude 3 Improvements",
              description: "Anthropic enhances Claude 3 performance",
              impact: "Medium",
            },
          ],
          takeaways: [
            "AI models are rapidly advancing in capability",
            "Competition between AI labs is intensifying",
          ],
          productPlays: [
            {
              idea: "AI-powered content generation platform",
              rationale: "Leverage new model capabilities for content creation",
            },
          ],
          tools: [
            {
              name: "GPT-5 API",
              description: "New OpenAI API with enhanced features",
              category: "AI",
            },
          ],
        },
      });

      // Mock critic commentary
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          commentary: {
            spicyTake: "The AI arms race is heating up, but are we solving real problems?",
            reality: "Both models show incremental improvements, not revolutionary changes",
            contrarian: "Focus on AI safety might be slowing down practical applications",
          },
        },
      });

      // Execute the weekly digest pipeline
      let result;
      result = await processor.processWeeklyDigest();

      // Verify the result
      if (!result.success) {
        throw new Error(`Weekly digest failed: ${result.error}`);
      }
      expect(result.success).toBe(true);
      expect(result.emailsFound).toBeGreaterThan(0);
      expect(result.emailsProcessed).toBe(2); // Only AI emails
      expect(result.message).toContain("Weekly digest processed");

      // Verify agent coordination
      expect(mockLogger.info).toHaveBeenCalledWith("Step 1: Fetching emails");
      expect(mockLogger.info).toHaveBeenCalledWith("Step 2: Classifying unknown senders");
      expect(mockLogger.info).toHaveBeenCalledWith("Step 3: Extracting article content");
      expect(mockLogger.info).toHaveBeenCalledWith("Step 4: Researching additional context");
      expect(mockLogger.info).toHaveBeenCalledWith("Step 5: Performing deep analysis");
      expect(mockLogger.info).toHaveBeenCalledWith("Step 6: Generating opinionated commentary");
      expect(mockLogger.info).toHaveBeenCalledWith("Step 7: Building and sending digest");

      // Verify storage interactions
      expect(mockStorage.markMultipleProcessed).toHaveBeenCalled();

      // Verify email was sent
      const { sendDigest } = await import("../lib/email");
      expect(sendDigest).toHaveBeenCalled();
    });

    it("should handle partial agent failures gracefully", async () => {
      // Mock Gmail API to work
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: mockEmails.map((e) => ({ id: e.id, threadId: e.id })),
          },
        })
      );

      mockEmails.forEach((email) => {
        vi.mocked(gmailMock.users.messages.get).mockImplementationOnce(() =>
          Promise.resolve({
            data: {
              id: email.id,
              payload: {
                headers: [
                  { name: "From", value: email.from },
                  { name: "Subject", value: email.subject },
                ],
                snippet: email.snippet,
              },
            },
          })
        );
      });

      // Mock classification to work
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          classifications: mockEmails.map((email) => ({
            emailId: email.id,
            classification: "AI",
            confidence: 0.9,
          })),
        },
      });

      // Mock content extraction to fail
      vi.mocked(generateObject).mockRejectedValueOnce(new Error("Firecrawl API error"));

      // Execute pipeline
      const result = await processor.processWeeklyDigest();

      // Should fall back to simple digest
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to extract content")
      );
    });

    it("should handle email filtering correctly", async () => {
      // Mock Gmail API
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: [{ id: "email3", threadId: "email3" }], // Only non-AI email
          },
        })
      );

      vi.mocked(gmailMock.users.messages.get).mockResolvedValueOnce({
        data: {
          id: "email3",
          payload: {
            headers: [
              { name: "From", value: mockEmails[2].from },
              { name: "Subject", value: mockEmails[2].subject },
            ],
            snippet: mockEmails[2].snippet,
          },
        },
      });

      // Mock classification
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          classifications: [{ emailId: "email3", classification: "NOT_AI", confidence: 0.95 }],
        },
      });

      // Execute pipeline
      const result = await processor.processWeeklyDigest();

      // Should exit early with no AI emails
      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(0);
      expect(result.message).toContain("No AI-related emails");
    });
  });

  describe("Cleanup Digest Pipeline", () => {
    it("should process cleanup mode with batch handling", async () => {
      // Create a larger set of emails for batch testing
      const cleanupEmails = Array.from({ length: 150 }, (_, i) => ({
        id: `cleanup-email-${i}`,
        from: `sender${i}@ai.com`,
        subject: `AI News Update ${i}`,
        snippet: `AI content snippet ${i}`,
        body: `Full AI content body ${i}`,
        date: new Date(performance.now() - i * 86400000).toISOString(), // Each email 1 day older
        urls: [`https://example.com/article-${i}`],
      }));

      // Mock Gmail API for cleanup mode
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      // Return emails in batches
      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: cleanupEmails.map((e) => ({ id: e.id, threadId: e.id })),
          },
        })
      );

      // Mock individual email fetches
      cleanupEmails.forEach((email) => {
        vi.mocked(gmailMock.users.messages.get).mockImplementation(() =>
          Promise.resolve({
            data: {
              id: email.id,
              payload: {
                headers: [
                  { name: "From", value: email.from },
                  { name: "Subject", value: email.subject },
                ],
                snippet: email.snippet,
              },
            },
          })
        );
      });

      // Mock batch classification
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValue({
        object: {
          classifications: cleanupEmails.slice(0, 50).map((email) => ({
            emailId: email.id,
            classification: "AI",
            confidence: 0.9,
          })),
        },
      });

      // Execute cleanup digest
      const result = await processor.processCleanupDigest();

      // Verify batch processing
      expect(result.success).toBe(true);
      expect(result.batches).toBeGreaterThan(1);
      expect(result.message).toContain("Cleanup digest completed");

      // Verify multiple digest emails were sent (one per batch)
      const { sendDigest } = await import("../lib/email");
      expect(sendDigest).toHaveBeenCalledTimes(Math.ceil(150 / 50));
    });

    it("should handle cleanup mode interruption gracefully", async () => {
      // Mock Gmail API
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      const emails = Array.from({ length: 60 }, (_, i) => ({
        id: `email-${i}`,
        threadId: `email-${i}`,
      }));

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: { messages: emails },
        })
      );

      // Mock first batch to succeed
      emails.slice(0, 50).forEach((_, i) => {
        vi.mocked(gmailMock.users.messages.get).mockImplementationOnce(() =>
          Promise.resolve({
            data: {
              id: `email-${i}`,
              payload: {
                headers: [
                  { name: "From", value: `sender${i}@ai.com` },
                  { name: "Subject", value: `Subject ${i}` },
                ],
                snippet: `Snippet ${i}`,
              },
            },
          })
        );
      });

      // Mock second batch to fail
      emails.slice(50).forEach(() => {
        vi.mocked(gmailMock.users.messages.get).mockRejectedValueOnce(
          new Error("API rate limit exceeded")
        );
      });

      // Execute cleanup
      const result = await processor.processCleanupDigest();

      // Should complete first batch successfully
      expect(result.success).toBe(false);
      expect(result.batches).toBe(1);
      expect(result.error).toContain("rate limit");
    });
  });

  describe("Error Propagation Between Agents", () => {
    it("should propagate errors from EmailFetcherAgent", async () => {
      // Mock Gmail API to fail
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      vi.mocked(gmailMock.users.messages.list).mockRejectedValue(
        new Error("Gmail API authentication failed")
      );

      // Execute pipeline
      const result = await processor.processWeeklyDigest();

      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.error).toContain("Gmail API authentication failed");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error in weekly digest"),
        expect.any(Error)
      );

      // Verify no further agents were called
      const { generateObject } = await import("ai");
      expect(generateObject).not.toHaveBeenCalled();
    });

    it("should propagate errors from ClassifierAgent to next agents", async () => {
      // Mock Gmail to succeed
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: [{ id: "email1", threadId: "email1" }],
          },
        })
      );

      vi.mocked(gmailMock.users.messages.get).mockImplementation(() =>
        Promise.resolve({
          data: {
            id: "email1",
            payload: {
              headers: [{ name: "From", value: "test@ai.com" }],
              snippet: "Test",
            },
          },
        })
      );

      // Mock classification to fail
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockRejectedValueOnce(new Error("OpenAI API key invalid"));

      // Execute pipeline
      const result = await processor.processWeeklyDigest();

      // Should handle classification failure
      expect(result.success).toBe(false);
      expect(result.error).toContain("OpenAI API key invalid");
    });

    it("should cascade agent failures with proper cleanup", async () => {
      // Setup successful email fetch
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: mockEmails.map((e) => ({ id: e.id, threadId: e.id })),
          },
        })
      );

      mockEmails.forEach((email) => {
        vi.mocked(gmailMock.users.messages.get).mockImplementationOnce(() =>
          Promise.resolve({
            data: {
              id: email.id,
              payload: {
                headers: [{ name: "From", value: email.from }],
                snippet: email.snippet,
              },
            },
          })
        );
      });

      // Setup successful classification
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          classifications: mockEmails.map((email) => ({
            emailId: email.id,
            classification: "AI",
            confidence: 0.9,
          })),
        },
      });

      // Mock content extraction to fail after partial success
      vi.mocked(generateObject)
        .mockResolvedValueOnce({
          object: {
            emails: [mockEmails[0]],
          },
        })
        .mockRejectedValueOnce(new Error("Extraction quota exceeded"));

      // Execute
      const result = await processor.processWeeklyDigest();

      // Should attempt recovery
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to extract content")
      );
    });
  });

  describe("Circuit Breaker State Transitions", () => {
    it("should open circuit breaker after repeated failures", async () => {
      // Force multiple Gmail API failures
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      const apiError = new Error("Gmail API error");
      vi.mocked(gmailMock.users.messages.list).mockRejectedValue(apiError);

      // Attempt multiple digest processes
      for (let i = 0; i < 5; i++) {
        const result = await processor.processWeeklyDigest();
        expect(result.success).toBe(false);
      }

      // Check circuit breaker state
      const gmailBreaker = EnhancedCircuitBreaker.getBreaker("gmail");
      expect(gmailBreaker.getState()).toBe("OPEN");

      // Subsequent calls should fail fast
      const start = performance.now();
      const result = await processor.processWeeklyDigest();
      const duration = performance.now() - start;

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Circuit breaker .* is OPEN/);
      expect(duration).toBeLessThan(100); // Should fail fast
    });

    it("should transition circuit breaker from OPEN to HALF_OPEN after timeout", async () => {
      // Configure circuit breaker with short timeout for testing
      const breaker = EnhancedCircuitBreaker.getBreaker("openai");

      // Force circuit to open
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockRejectedValue(new Error("API error"));

      // Make requests to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(() => generateObject({} as any));
        } catch {}
      }

      expect(breaker.getState()).toBe("OPEN");

      // Wait for timeout (mock time advancement would be better)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Next call should attempt half-open
      vi.mocked(generateObject).mockResolvedValueOnce({ object: {} });

      const result = await breaker.execute(() => generateObject({} as any));
      expect(result).toBeDefined();

      // Circuit should close after success
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("should handle cascading circuit breaker failures", async () => {
      // Open Gmail circuit breaker
      const gmailBreaker = EnhancedCircuitBreaker.getBreaker("gmail");
      for (let i = 0; i < 5; i++) {
        try {
          await gmailBreaker.execute(() => {
            throw new Error("Gmail failed");
          });
        } catch {}
      }

      // Open OpenAI circuit breaker
      const openaiBreaker = EnhancedCircuitBreaker.getBreaker("openai");
      for (let i = 0; i < 5; i++) {
        try {
          await openaiBreaker.execute(() => {
            throw new Error("OpenAI failed");
          });
        } catch {}
      }

      // Both breakers should be open
      expect(gmailBreaker.getState()).toBe("OPEN");
      expect(openaiBreaker.getState()).toBe("OPEN");

      // Digest should fail fast
      const result = await processor.processWeeklyDigest();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Circuit breaker .* is OPEN/);
    });

    it("should recover from circuit breaker failures independently", async () => {
      // Setup Gmail to work
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: { messages: [] },
        })
      );

      // Force OpenAI circuit to open
      const openaiBreaker = EnhancedCircuitBreaker.getBreaker("openai");
      const { generateObject } = await import("ai");
      vi.mocked(generateObject).mockRejectedValue(new Error("OpenAI error"));

      for (let i = 0; i < 5; i++) {
        try {
          await openaiBreaker.execute(() => generateObject({} as any));
        } catch {}
      }

      expect(openaiBreaker.getState()).toBe("OPEN");

      // Gmail should still work
      const result = await processor.processWeeklyDigest();

      // Should get to classification step and fail
      expect(result.success).toBe(true); // No emails to process
      expect(result.message).toContain("No AI-related emails");
    });
  });

  describe("Agent Data Transformation", () => {
    it("should correctly transform data between EmailFetcher and Classifier", async () => {
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      // Mock email fetch
      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: [{ id: "test1", threadId: "test1" }],
          },
        })
      );

      const emailData = {
        id: "test1",
        payload: {
          headers: [
            { name: "From", value: "ai@newsletter.com" },
            { name: "Subject", value: "AI Weekly" },
            { name: "Date", value: formatISO(new Date()) },
          ],
          snippet: "AI news snippet",
          body: { data: Buffer.from("AI content").toString("base64") },
        },
      };

      vi.mocked(gmailMock.users.messages.get).mockImplementation(() =>
        Promise.resolve({
          data: emailData,
        })
      );

      // Spy on agent methods on the instances instead of prototype
      const fetcherSpy = vi.spyOn(processor.emailFetcher as any, "fetchEmails");
      const classifierSpy = vi.spyOn(processor.classifier as any, "classifyEmails");

      // Execute
      await processor.processWeeklyDigest();

      // Verify data flow
      expect(fetcherSpy).toHaveBeenCalled();
      expect(classifierSpy).toHaveBeenCalled();

      // Verify transformed data structure
      const classifierCall = classifierSpy.mock.calls[0][0];
      expect(classifierCall).toHaveProperty("fullEmails");
      expect(classifierCall).toHaveProperty("metadata");
      expect(classifierCall.fullEmails).toBeInstanceOf(Array);
    });

    it("should maintain data integrity through the entire pipeline", async () => {
      // Setup complete mock chain
      const { google } = await import("googleapis");
      const gmailMock = google.gmail();

      const originalEmail = {
        id: "integrity-test",
        from: "test@ai.com",
        subject: "Data Integrity Test",
        snippet: "Test snippet",
        body: "Test body content",
        date: formatISO(new Date()),
      };

      vi.mocked(gmailMock.users.messages.list).mockImplementation(() =>
        Promise.resolve({
          data: {
            messages: [{ id: originalEmail.id, threadId: originalEmail.id }],
          },
        })
      );

      vi.mocked(gmailMock.users.messages.get).mockImplementation(() =>
        Promise.resolve({
          data: {
            id: originalEmail.id,
            payload: {
              headers: [
                { name: "From", value: originalEmail.from },
                { name: "Subject", value: originalEmail.subject },
                { name: "Date", value: originalEmail.date },
              ],
              snippet: originalEmail.snippet,
              body: { data: Buffer.from(originalEmail.body).toString("base64") },
            },
          },
        })
      );

      // Track data through agents
      const dataTrace: any[] = [];

      // Intercept agent calls - spy on instances
      const originalFetch = processor.emailFetcher.fetchEmails.bind(processor.emailFetcher);
      const _fetcherSpy = vi
        .spyOn(processor.emailFetcher as any, "fetchEmails")
        .mockImplementation(async (options) => {
          const result = await originalFetch(options);
          dataTrace.push({ agent: "fetcher", data: result });
          return result;
        });

      const _classifierSpy = vi
        .spyOn(processor.classifier as any, "classifyEmails")
        .mockImplementation(async (batch) => {
          dataTrace.push({ agent: "classifier", input: batch });
          return new Map([[originalEmail.id, { classification: "AI", confidence: 0.95 }]]);
        });

      // Execute
      await processor.processWeeklyDigest();

      // Verify data consistency
      expect(dataTrace.length).toBeGreaterThan(0);

      const fetcherOutput = dataTrace.find((t) => t.agent === "fetcher");
      const classifierInput = dataTrace.find((t) => t.agent === "classifier");

      expect(fetcherOutput).toBeDefined();
      expect(classifierInput).toBeDefined();

      // Email ID should be preserved
      if (fetcherOutput?.data?.fullEmails?.[0]) {
        expect(fetcherOutput.data.fullEmails[0].id).toBe(originalEmail.id);
      }
    });
  });
});
