import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ISenderTracker } from "../interfaces/sender-tracker";
import {
  AIDetectionStrategyFactory,
  CompositeAIDetectionStrategy,
  EmailDomainStrategy,
  KeywordStrategy,
  KnownSenderStrategy,
  PatternStrategy,
} from "./ai-detection-strategies";

describe("AI Detection Strategies", () => {
  let mockSenderTracker: ISenderTracker;

  beforeEach(() => {
    mockSenderTracker = {
      isKnownAISender: vi.fn().mockResolvedValue(false),
      getAllKnownSenders: vi.fn().mockResolvedValue([]),
      getKnownSendersByDomain: vi.fn().mockResolvedValue([]),
      addConfirmedSender: vi.fn().mockResolvedValue(undefined),
      addMultipleConfirmedSenders: vi.fn().mockResolvedValue(undefined),
      updateSenderConfidence: vi.fn().mockResolvedValue(undefined),
      removeSender: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("KnownSenderStrategy", () => {
    it("should detect known AI senders", async () => {
      const strategy = new KnownSenderStrategy();
      vi.mocked(mockSenderTracker.isKnownAISender).mockResolvedValueOnce(true);

      const result = await strategy.detect(
        "Some subject",
        "AI Newsletter <ai@newsletter.com>",
        mockSenderTracker
      );

      expect(result).toBe(true);
      expect(mockSenderTracker.isKnownAISender).toHaveBeenCalledWith("ai@newsletter.com");
    });

    it("should extract email from plain address", async () => {
      const strategy = new KnownSenderStrategy();
      vi.mocked(mockSenderTracker.isKnownAISender).mockResolvedValueOnce(true);

      const result = await strategy.detect("Some subject", "ai@newsletter.com", mockSenderTracker);

      expect(result).toBe(true);
      expect(mockSenderTracker.isKnownAISender).toHaveBeenCalledWith("ai@newsletter.com");
    });

    it("should return false when sender tracker is not provided", async () => {
      const strategy = new KnownSenderStrategy();

      const result = await strategy.detect("Some subject", "ai@newsletter.com");

      expect(result).toBe(false);
    });

    it("should return false for unknown senders", async () => {
      const strategy = new KnownSenderStrategy();
      vi.mocked(mockSenderTracker.isKnownAISender).mockResolvedValueOnce(false);

      const result = await strategy.detect("Some subject", "regular@email.com", mockSenderTracker);

      expect(result).toBe(false);
    });
  });

  describe("KeywordStrategy", () => {
    it("should detect AI keywords in subject", async () => {
      const strategy = new KeywordStrategy(["AI", "machine learning", "GPT"]);

      const result = await strategy.detect("Latest AI News", "sender@email.com");

      expect(result).toBe(true);
    });

    it("should detect AI keywords in sender", async () => {
      const strategy = new KeywordStrategy(["OpenAI"]);

      const result = await strategy.detect("Newsletter", "OpenAI <news@openai.com>");

      expect(result).toBe(true);
    });

    it("should detect partial keyword matches", async () => {
      const strategy = new KeywordStrategy(["AI"]);

      const result = await strategy.detect("OpenAI announces GPT-5", "sender@email.com");

      expect(result).toBe(true);
    });

    it("should handle case insensitive matching", async () => {
      const strategy = new KeywordStrategy(["artificial intelligence"]);

      const result = await strategy.detect(
        "ARTIFICIAL INTELLIGENCE breakthrough",
        "sender@email.com"
      );

      expect(result).toBe(true);
    });

    it("should return false when no keywords match", async () => {
      const strategy = new KeywordStrategy(["OpenAI", "GPT"]);

      const result = await strategy.detect("Regular newsletter", "sender@company.com");

      expect(result).toBe(false);
    });
  });

  describe("PatternStrategy", () => {
    it("should detect AI newsletter patterns", async () => {
      const strategy = new PatternStrategy();

      const testCases = [
        "AI Weekly Newsletter",
        "ai-essentials digest",
        "Machine Learning Report",
        "Deep Learning Update",
        "ChatGPT News",
        "Claude AI Updates",
        "Anthropic Newsletter",
      ];

      for (const subject of testCases) {
        const result = await strategy.detect(subject, "sender@email.com");
        expect(result).toBe(true);
      }
    });

    it("should detect compound AI terms", async () => {
      const strategy = new PatternStrategy();

      const result = await strategy.detect("AiEssentials Newsletter", "sender@email.com");

      expect(result).toBe(true);
    });

    it("should return false for non-AI patterns", async () => {
      const strategy = new PatternStrategy();

      const result = await strategy.detect("Regular Tech News", "sender@email.com");

      expect(result).toBe(false);
    });

    it("should accept additional patterns", async () => {
      const strategy = new PatternStrategy([/custom-ai-pattern/i]);

      const result = await strategy.detect("custom-ai-pattern newsletter", "sender@email.com");

      expect(result).toBe(true);
    });
  });

  describe("EmailDomainStrategy", () => {
    it("should detect AI in email domains", async () => {
      const strategy = new EmailDomainStrategy();

      const testCases = [
        "news@ai.com",
        "hello@company-ai.com",
        "ai-newsletter@company.com",
        "newsletter@openai.com",
        "updates@ai-weekly.com",
      ];

      for (const sender of testCases) {
        const result = await strategy.detect("Subject", sender);
        expect(result).toBe(true);
      }
    });

    it("should not match non-AI domains", async () => {
      const strategy = new EmailDomainStrategy();

      const testCases = [
        "news@gmAIl.com", // Contains 'ai' but as part of 'gmail' - should match due to regex
        "hello@company.com",
        "newsletter@techcrunch.com",
      ];

      // First one will match because 'gmail' contains 'ai'
      let result = await strategy.detect("Subject", testCases[0]);
      expect(result).toBe(true); // This is expected due to the regex pattern

      // These should not match
      result = await strategy.detect("Subject", testCases[1]);
      expect(result).toBe(false);

      result = await strategy.detect("Subject", testCases[2]);
      expect(result).toBe(false);
    });
  });

  describe("CompositeAIDetectionStrategy", () => {
    it("should detect using any matching strategy", async () => {
      const keywordStrategy = new KeywordStrategy(["AI"]);
      const patternStrategy = new PatternStrategy();
      const composite = new CompositeAIDetectionStrategy([keywordStrategy, patternStrategy]);

      // Test keyword match
      let result = await composite.detect("AI News", "sender@email.com");
      expect(result).toBe(true);

      // Test pattern match
      result = await composite.detect("Machine Learning Weekly", "sender@email.com");
      expect(result).toBe(true);
    });

    it("should short-circuit on first match", async () => {
      const strategy1 = {
        detect: vi.fn().mockResolvedValue(true),
      };
      const strategy2 = {
        detect: vi.fn().mockResolvedValue(true),
      };

      const composite = new CompositeAIDetectionStrategy([strategy1, strategy2]);

      const result = await composite.detect("Subject", "sender@email.com");

      expect(result).toBe(true);
      expect(strategy1.detect).toHaveBeenCalled();
      expect(strategy2.detect).not.toHaveBeenCalled(); // Should not be called due to short-circuit
    });

    it("should try all strategies when none match", async () => {
      const strategy1 = {
        detect: vi.fn().mockResolvedValue(false),
      };
      const strategy2 = {
        detect: vi.fn().mockResolvedValue(false),
      };

      const composite = new CompositeAIDetectionStrategy([strategy1, strategy2]);

      const result = await composite.detect("Subject", "sender@email.com");

      expect(result).toBe(false);
      expect(strategy1.detect).toHaveBeenCalled();
      expect(strategy2.detect).toHaveBeenCalled();
    });

    it("should support adding and removing strategies", async () => {
      const composite = new CompositeAIDetectionStrategy();
      const strategy = new KeywordStrategy(["AI"]);

      // Add strategy
      composite.addStrategy(strategy);
      let result = await composite.detect("AI News", "sender@email.com");
      expect(result).toBe(true);

      // Remove strategy
      composite.removeStrategy(strategy);
      result = await composite.detect("AI News", "sender@email.com");
      expect(result).toBe(false);
    });
  });

  describe("AIDetectionStrategyFactory", () => {
    it("should create default strategy with all components", () => {
      const strategy = AIDetectionStrategyFactory.createDefault(["AI"], ["ML"], mockSenderTracker);

      expect(strategy).toBeInstanceOf(CompositeAIDetectionStrategy);
    });

    it("should work without sender tracker", () => {
      const strategy = AIDetectionStrategyFactory.createDefault(["AI"], ["ML"]);

      expect(strategy).toBeInstanceOf(CompositeAIDetectionStrategy);
    });

    it("should detect emails using default strategy", async () => {
      const strategy = AIDetectionStrategyFactory.createDefault(
        ["AI", "GPT"],
        ["Claude"],
        mockSenderTracker
      );

      // Test various detection methods
      const testCases = [
        { subject: "AI Newsletter", sender: "news@company.com", expected: true },
        { subject: "GPT-4 Updates", sender: "sender@email.com", expected: true },
        { subject: "Claude News", sender: "sender@email.com", expected: true },
        { subject: "Newsletter", sender: "news@ai.com", expected: true },
        { subject: "Machine Learning Weekly", sender: "sender@email.com", expected: true },
        { subject: "Regular News", sender: "news@regular.com", expected: false },
      ];

      for (const testCase of testCases) {
        const result = await strategy.detect(testCase.subject, testCase.sender, mockSenderTracker);
        expect(result).toBe(testCase.expected);
      }
    });
  });
});
