import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEmailItem, MockLogger, MockStorageClient } from "../../test/utils/test-helpers";

// Mock the external modules - must be done before imports
vi.mock("../lib/gmail");
vi.mock("../lib/email");
vi.mock("../lib/summarizer");
vi.mock("../lib/metrics", () => ({
  metrics: {
    emailsProcessed: vi.fn(),
    apiCall: vi.fn((service, operation, fn) => fn()),
    digestGenerated: vi.fn(),
    error: vi.fn(),
    storageOperation: vi.fn((operation, fn) => fn()),
    lambdaInvocation: vi.fn(),
    cleanupMode: vi.fn(),
  },
  getMetrics: vi.fn(() => ({
    increment: vi.fn(),
    gauge: vi.fn(),
    timer: vi.fn((name, fn) => fn()),
    histogram: vi.fn(),
    flush: vi.fn(),
  })),
}));

import { sendDigest, sendErrorNotification } from "../lib/email";
import { gmailClient } from "../lib/gmail";
import { summarize } from "../lib/summarizer";
import { DigestProcessor } from "./digest-processor";

describe("DigestProcessor", () => {
  let processor: DigestProcessor;
  let mockLogger: MockLogger;
  let mockStorage: MockStorageClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = new MockLogger();
    mockStorage = new MockStorageClient();

    // Set up mocks for external modules
    vi.mocked(gmailClient).getWeeklyAIEmails = vi.fn().mockResolvedValue([]);
    vi.mocked(gmailClient).getAllAIEmails = vi.fn().mockResolvedValue([]);
    vi.mocked(gmailClient).archiveOldEmails = vi.fn().mockResolvedValue(0);
    vi.mocked(gmailClient).archiveMessages = vi.fn().mockResolvedValue(undefined);
    vi.mocked(gmailClient).getSenderTracker = vi.fn().mockReturnValue({
      addMultipleConfirmedSenders: vi.fn().mockResolvedValue(undefined),
      isKnownAISender: vi.fn().mockResolvedValue(false),
    });

    vi.mocked(sendDigest).mockResolvedValue(undefined);
    vi.mocked(sendErrorNotification).mockResolvedValue(undefined);
    vi.mocked(summarize).mockResolvedValue({
      digest: {
        headline: "Test Headline",
        summary: "Test Summary",
        whatHappened: [],
        takeaways: [],
        rolePlays: [],
        productPlays: [],
        tools: [],
        shortMessage: "Test message",
        keyThemes: [],
      },
      message: "Test message",
      items: [],
      generatedAt: new Date().toISOString(),
    });

    processor = new DigestProcessor({
      storage: mockStorage,
      logger: mockLogger,
    });
  });

  describe("processWeeklyDigest", () => {
    it("should process weekly digest successfully with new emails", async () => {
      const mockEmails = [
        createMockEmailItem({ id: "email-1", subject: "AI Update 1" }),
        createMockEmailItem({ id: "email-2", subject: "AI Update 2" }),
      ];

      vi.mocked(gmailClient).getWeeklyAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getWeeklyProcessedIds.mockResolvedValue([]);

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(2);
      expect(result.emailsProcessed).toBe(2);
      expect(result.message).toContain("Successfully processed 2 AI emails");
      expect(mockStorage.markMultipleProcessed).toHaveBeenCalledWith(
        expect.arrayContaining([
          { id: "email-1", subject: "AI Update 1" },
          { id: "email-2", subject: "AI Update 2" },
        ])
      );
    });

    it("should skip processing when no emails are found", async () => {
      vi.mocked(gmailClient).getWeeklyAIEmails.mockResolvedValue([]);

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(0);
      expect(result.emailsProcessed).toBe(0);
      expect(result.message).toBe("No AI-related emails found to process");
      expect(mockStorage.markMultipleProcessed).not.toHaveBeenCalled();
    });

    it("should skip already processed emails", async () => {
      const mockEmails = [
        createMockEmailItem({ id: "email-1", subject: "AI Update 1" }),
        createMockEmailItem({ id: "email-2", subject: "AI Update 2" }),
      ];

      vi.mocked(gmailClient).getWeeklyAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getWeeklyProcessedIds.mockResolvedValue(["email-1"]);

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(2);
      expect(result.emailsProcessed).toBe(1);
      expect(mockStorage.markMultipleProcessed).toHaveBeenCalledWith([
        { id: "email-2", subject: "AI Update 2" },
      ]);
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Gmail API error");

      vi.mocked(gmailClient).getWeeklyAIEmails.mockRejectedValue(error);

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Gmail API error");
      expect(sendErrorNotification).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should archive old emails after successful processing", async () => {
      const mockEmails = [createMockEmailItem()];

      vi.mocked(gmailClient).getWeeklyAIEmails.mockResolvedValue(mockEmails);
      vi.mocked(gmailClient).archiveOldEmails.mockResolvedValue(3);
      mockStorage.getWeeklyProcessedIds.mockResolvedValue([]);

      const result = await processor.processWeeklyDigest();

      expect(result.success).toBe(true);
      expect(vi.mocked(gmailClient).archiveOldEmails).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Archived 3 old emails")
      );
    });

    it("should save confirmed AI senders", async () => {
      const mockEmails = [createMockEmailItem({ sender: "ai-news@example.com" })];

      vi.mocked(gmailClient).getWeeklyAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getWeeklyProcessedIds.mockResolvedValue([]);

      await processor.processWeeklyDigest();

      const senderTracker = gmailClient.getSenderTracker();
      expect(senderTracker.addMultipleConfirmedSenders).toHaveBeenCalledWith([
        { email: "ai-news@example.com", name: "ai-news@example.com" },
      ]);
    });
  });

  describe("processCleanupDigest", () => {
    it("should process all unprocessed emails in batches", async () => {
      vi.useFakeTimers();

      const mockEmails = Array.from({ length: 120 }, (_, i) =>
        createMockEmailItem({ id: `email-${i}`, subject: `AI Update ${i}` })
      );

      vi.mocked(gmailClient).getAllAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getAllProcessedIds.mockResolvedValue([]);

      const resultPromise = processor.processCleanupDigest();

      // Fast-forward through all the setTimeout delays
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(120);
      expect(result.emailsProcessed).toBe(120);
      expect(result.batches).toBe(3); // 120 emails / 50 per batch
      expect(mockStorage.markMultipleProcessed).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should skip cleanup when no emails are found", async () => {
      vi.mocked(gmailClient).getAllAIEmails.mockResolvedValue([]);

      const result = await processor.processCleanupDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(0);
      expect(result.emailsProcessed).toBe(0);
      expect(result.message).toBe("No AI-related emails found in inbox");
    });

    it("should filter out already processed emails", async () => {
      const mockEmails = [
        createMockEmailItem({ id: "email-1" }),
        createMockEmailItem({ id: "email-2" }),
        createMockEmailItem({ id: "email-3" }),
      ];

      vi.mocked(gmailClient).getAllAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getAllProcessedIds.mockResolvedValue(["email-1", "email-2"]);

      const result = await processor.processCleanupDigest();

      expect(result.success).toBe(true);
      expect(result.emailsFound).toBe(3);
      expect(result.emailsProcessed).toBe(1);
      expect(mockStorage.markMultipleProcessed).toHaveBeenCalledWith([
        { id: "email-3", subject: expect.any(String) },
      ]);
    });

    it("should continue processing even if one batch fails", async () => {
      const mockEmails = Array.from({ length: 100 }, (_, i) =>
        createMockEmailItem({ id: `email-${i}` })
      );

      vi.mocked(gmailClient).getAllAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getAllProcessedIds.mockResolvedValue([]);

      // Make the first batch fail
      vi.mocked(sendDigest)
        .mockRejectedValueOnce(new Error("Email send failed"))
        .mockResolvedValue(undefined);

      const result = await processor.processCleanupDigest();

      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(50); // Only second batch processed
      expect(result.batches).toBe(2);
    });

    it("should cleanup old records after processing", async () => {
      const mockEmails = [createMockEmailItem()];

      vi.mocked(gmailClient).getAllAIEmails.mockResolvedValue(mockEmails);
      mockStorage.getAllProcessedIds.mockResolvedValue([]);
      mockStorage.cleanupOldRecords.mockResolvedValue(10);

      const result = await processor.processCleanupDigest();

      expect(result.success).toBe(true);
      expect(mockStorage.cleanupOldRecords).toHaveBeenCalledWith(90);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up 10 old processed records")
      );
    });

    it("should archive emails after processing", async () => {
      const mockEmails = [createMockEmailItem({ id: "email-1" })];

      vi.mocked(gmailClient).getAllAIEmails.mockResolvedValue(mockEmails);
      vi.mocked(gmailClient).archiveOldEmails.mockResolvedValue(5);
      mockStorage.getAllProcessedIds.mockResolvedValue([]);

      const result = await processor.processCleanupDigest();

      expect(result.success).toBe(true);
      expect(vi.mocked(gmailClient).archiveOldEmails).toHaveBeenCalled();
      expect(vi.mocked(gmailClient).archiveMessages).toHaveBeenCalledWith(["email-1"]);
    });
  });
});
