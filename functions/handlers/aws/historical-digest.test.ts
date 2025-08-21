import type { APIGatewayProxyEvent } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock AWS SDK
vi.mock("@aws-sdk/client-sfn", () => {
  const mockSend = vi.fn();
  return {
    SFNClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    StartExecutionCommand: vi.fn(),
    mockSend, // Export for test access
  };
});

import { handler } from "./historical-digest";

describe("Historical Digest Handler", () => {
  let mockEvent: Partial<APIGatewayProxyEvent>;
  let mockSend: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mock send function
    const sfnModule = (await import("@aws-sdk/client-sfn")) as any;
    mockSend = sfnModule.mockSend;

    // Setup mock send function
    mockSend.mockResolvedValue({
      executionArn: "arn:aws:states:us-east-1:123456789:execution:test-execution",
    });

    // Setup environment
    process.env.STATE_MACHINE_ARN = "arn:aws:states:us-east-1:123456789:stateMachine:test-machine";

    // Base event
    mockEvent = {
      body: JSON.stringify({
        startDate: "2024-12-01",
        endDate: "2024-12-31",
      }),
      headers: {},
      httpMethod: "POST",
      path: "/historical",
    };
  });

  describe("Successful Requests", () => {
    it("should process valid historical request", async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(202);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Historical digest processing started");
      expect(body.executionArn).toBeDefined();
      expect(body.dateRange).toEqual({
        start: "2024-12-01",
        end: "2024-12-31",
        days: 31,
      });
    });

    it("should handle custom batch size", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "2024-12-01",
        endDate: "2024-12-31",
        batchSize: 100,
      });

      await handler(mockEvent as APIGatewayProxyEvent);

      // Verify Step Functions was called with correct parameters
      const { StartExecutionCommand } = await import("@aws-sdk/client-sfn");
      expect(StartExecutionCommand).toHaveBeenCalledWith({
        stateMachineArn: process.env.STATE_MACHINE_ARN,
        input: JSON.stringify({
          mode: "historical",
          startDate: "2024-12-01",
          endDate: "2024-12-31",
          batchSize: 100,
          includeArchived: true,
        }),
      });
    });

    it("should calculate days correctly for single day", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "2024-12-25",
        endDate: "2024-12-25",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(body.dateRange.days).toBe(1);
    });

    it("should calculate days correctly for month range", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(body.dateRange.days).toBe(31);
    });
  });

  describe("Validation Errors", () => {
    it("should reject missing startDate", async () => {
      mockEvent.body = JSON.stringify({
        endDate: "2024-12-31",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("Missing required parameters");
    });

    it("should reject missing endDate", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "2024-12-01",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("Missing required parameters");
    });

    it("should reject invalid date format", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "invalid-date",
        endDate: "also-invalid",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("Invalid date format");
    });

    it("should reject startDate after endDate", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "2024-12-31",
        endDate: "2024-12-01",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("startDate must be before or equal to endDate");
    });

    it("should reject future dates", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      mockEvent.body = JSON.stringify({
        startDate: "2024-12-01",
        endDate: futureDate.toISOString().split("T")[0],
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("endDate cannot be in the future");
    });

    it("should reject date range over 90 days", async () => {
      mockEvent.body = JSON.stringify({
        startDate: "2024-01-01",
        endDate: "2024-06-01",
      });

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("Date range cannot exceed 90 days");
    });

    it("should handle empty body", async () => {
      mockEvent.body = "";

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(400);
      expect(body.error).toContain("Missing required parameters");
    });

    it("should handle invalid JSON", async () => {
      mockEvent.body = "invalid json";

      const result = await handler(mockEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
    });
  });

  describe("Error Handling", () => {
    it("should handle Step Functions error", async () => {
      mockSend.mockRejectedValue(new Error("Step Functions error"));

      const result = await handler(mockEvent as APIGatewayProxyEvent);
      const body = JSON.parse(result.body);

      expect(result.statusCode).toBe(500);
      expect(body.error).toContain("Step Functions error");
    });

    it("should handle missing STATE_MACHINE_ARN", async () => {
      delete process.env.STATE_MACHINE_ARN;

      // Mock send to throw when ARN is undefined
      mockSend.mockRejectedValue(new Error("Invalid StateMachineArn"));

      const result = await handler(mockEvent as APIGatewayProxyEvent);

      expect(result.statusCode).toBe(500);
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers in successful response", async () => {
      const result = await handler(mockEvent as APIGatewayProxyEvent);

      expect(result.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
    });

    it("should include CORS headers in error response", async () => {
      mockEvent.body = JSON.stringify({});

      const result = await handler(mockEvent as APIGatewayProxyEvent);

      expect(result.headers).toEqual({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
    });
  });
});
