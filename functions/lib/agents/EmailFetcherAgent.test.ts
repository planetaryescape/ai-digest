import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CostTracker } from "../cost-tracker";
import { EmailFetcherAgent } from "./EmailFetcherAgent";

// Mock dependencies
vi.mock("../gmail", () => ({
  gmailClient: {
    listMessages: vi.fn(),
    getMessage: vi.fn(),
    getMessageMetadata: vi.fn(),
  },
}));

vi.mock("../logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock("../metrics", () => ({
  getMetrics: () => ({
    gauge: vi.fn(),
  }),
}));

describe("EmailFetcherAgent - Historical Mode", () => {
  let emailFetcher: EmailFetcherAgent;
  let mockCostTracker: CostTracker;

  beforeEach(() => {
    mockCostTracker = {
      getTotalCost: vi.fn().mockReturnValue(0),
      addCost: vi.fn(),
      checkBudget: vi.fn().mockReturnValue(true),
    } as any;

    emailFetcher = new EmailFetcherAgent(mockCostTracker);
  });

  describe("Date Validation", () => {
    it("should accept valid date range", async () => {
      const { gmailClient } = await import("../gmail");
      (gmailClient.listMessages as any).mockResolvedValue([]);

      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          startDate: "2024-12-01",
          endDate: "2024-12-31",
        })
      ).resolves.not.toThrow();
    });

    it("should reject missing startDate", async () => {
      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          endDate: "2024-12-31",
        })
      ).rejects.toThrow("Historical mode requires startDate and endDate");
    });

    it("should reject missing endDate", async () => {
      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          startDate: "2024-12-01",
        })
      ).rejects.toThrow("Historical mode requires startDate and endDate");
    });

    it("should reject invalid date format", async () => {
      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          startDate: "invalid-date",
          endDate: "also-invalid",
        })
      ).rejects.toThrow("Invalid date format");
    });

    it("should reject startDate after endDate", async () => {
      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          startDate: "2024-12-31",
          endDate: "2024-12-01",
        })
      ).rejects.toThrow("startDate must be before or equal to endDate");
    });

    it("should reject future dates", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          startDate: "2024-12-01",
          endDate: futureDate.toISOString().split("T")[0],
        })
      ).rejects.toThrow("endDate cannot be in the future");
    });

    it("should reject date ranges over 90 days", async () => {
      await expect(
        emailFetcher.fetchEmails({
          mode: "historical",
          startDate: "2024-01-01",
          endDate: "2024-06-01",
        })
      ).rejects.toThrow("Date range cannot exceed 90 days");
    });
  });

  describe("Gmail Query Construction", () => {
    it("should format historical query correctly", async () => {
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      await emailFetcher.fetchEmails({
        mode: "historical",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
      });

      expect(listMessagesMock).toHaveBeenCalledWith("after:2024/12/1 before:2024/12/31", 1000);
    });

    it("should not include inbox restriction for historical mode", async () => {
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      await emailFetcher.fetchEmails({
        mode: "historical",
        startDate: "2024-12-01",
        endDate: "2024-12-31",
      });

      const query = listMessagesMock.mock.calls[0][0];
      expect(query).not.toContain("in:inbox");
    });

    it("should handle single-digit months and days", async () => {
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      await emailFetcher.fetchEmails({
        mode: "historical",
        startDate: "2024-01-05",
        endDate: "2024-02-09",
      });

      expect(listMessagesMock).toHaveBeenCalledWith("after:2024/1/5 before:2024/2/9", 1000);
    });
  });

  describe("Mode Comparison", () => {
    it("should use correct query for weekly mode", async () => {
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      await emailFetcher.fetchEmails({
        mode: "weekly",
      });

      expect(listMessagesMock).toHaveBeenCalledWith("in:inbox newer_than:7d", 500);
    });

    it("should use correct query for cleanup mode", async () => {
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      await emailFetcher.fetchEmails({
        mode: "cleanup",
      });

      expect(listMessagesMock).toHaveBeenCalledWith("in:inbox", 2000);
    });

    it("should use correct query for historical mode", async () => {
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      await emailFetcher.fetchEmails({
        mode: "historical",
        startDate: "2024-11-01",
        endDate: "2024-11-30",
      });

      expect(listMessagesMock).toHaveBeenCalledWith("after:2024/11/1 before:2024/11/30", 1000);
    });
  });
});

describe("Historical Mode Helper Functions", () => {
  describe("formatGmailDate", () => {
    it("should format ISO date to Gmail format", async () => {
      // Since formatGmailDate is private, we test it indirectly through the fetchEmails method
      const { gmailClient } = await import("../gmail");
      const listMessagesMock = gmailClient.listMessages as any;
      listMessagesMock.mockResolvedValue([]);

      const mockCostTracker = {
        getTotalCost: vi.fn().mockReturnValue(0),
        addCost: vi.fn(),
        checkBudget: vi.fn().mockReturnValue(true),
      } as any;

      const emailFetcher = new EmailFetcherAgent(mockCostTracker);

      await emailFetcher.fetchEmails({
        mode: "historical",
        startDate: "2024-12-25",
        endDate: "2024-12-31",
      });

      // Verify the date was formatted correctly in the Gmail query
      expect(listMessagesMock).toHaveBeenCalledWith(
        expect.stringContaining("after:2024/12/25"),
        expect.any(Number)
      );
    });
  });
});
