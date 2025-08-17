import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "./run-now";

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  InvokeCommand: vi.fn(),
}));

describe("run-now Lambda handler", () => {
  let mockLambdaClient: any;
  const mockContext: Context = {
    awsRequestId: "test-request-id",
    functionName: "run-now",
    functionVersion: "1",
    invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:run-now",
    memoryLimitInMB: "128",
    logGroupName: "/aws/lambda/run-now",
    logStreamName: "2024/01/01/[$LATEST]abc123",
    getRemainingTimeInMillis: () => 30000,
    callbackWaitsForEmptyEventLoop: false,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WEEKLY_DIGEST_FUNCTION_NAME = "weekly-digest-lambda";

    mockLambdaClient = {
      send: vi.fn().mockResolvedValue({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify({ success: true })),
      }),
    };
    vi.mocked(LambdaClient).mockImplementation(() => mockLambdaClient);
  });

  describe("cleanup mode detection", () => {
    it("should detect cleanup mode from direct invocation", async () => {
      const event = { cleanup: true };

      await handler(event as any, mockContext);

      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"cleanup":true'),
        })
      );
    });

    it("should detect cleanup mode from query parameters", async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: "GET",
        queryStringParameters: { cleanup: "true" },
      };

      await handler(event as APIGatewayProxyEvent, mockContext);

      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"cleanup":true'),
        })
      );
    });

    it("should detect cleanup mode from request body", async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: "POST",
        body: JSON.stringify({ cleanup: true }),
      };

      await handler(event as APIGatewayProxyEvent, mockContext);

      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"cleanup":true'),
        })
      );
    });

    it("should default to weekly mode when no cleanup flag", async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: "GET",
      };

      await handler(event as APIGatewayProxyEvent, mockContext);

      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Payload: expect.stringContaining('"cleanup":false'),
        })
      );
    });
  });

  describe("Lambda invocation", () => {
    it("should use async invocation for cleanup mode", async () => {
      const event = { cleanup: true };

      await handler(event as any, mockContext);

      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          InvocationType: "Event",
        })
      );
    });

    it("should use sync invocation for weekly mode", async () => {
      const event = { cleanup: false };

      await handler(event as any, mockContext);

      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          InvocationType: "RequestResponse",
        })
      );
    });

    it("should handle Lambda invocation errors", async () => {
      mockLambdaClient.send.mockRejectedValueOnce(new Error("Lambda invocation failed"));

      const event = {};
      const result = await handler(event as any, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: "Lambda invocation failed",
      });
    });

    it("should handle missing function name configuration", async () => {
      delete process.env.WEEKLY_DIGEST_FUNCTION_NAME;

      const event = {};
      const result = await handler(event as any, mockContext);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: "Weekly digest Lambda function name not configured",
      });
    });
  });

  describe("response handling", () => {
    it("should return success response for successful invocation", async () => {
      const event = {};
      const result = await handler(event as any, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        mode: "weekly",
      });
    });

    it("should handle async invocation response for cleanup mode", async () => {
      mockLambdaClient.send.mockResolvedValueOnce({
        StatusCode: 202,
      });

      const event = { cleanup: true };
      const result = await handler(event as any, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        mode: "cleanup",
        weeklyDigestResponse: {
          message: "Cleanup digest started asynchronously. Check CloudWatch logs for progress.",
          asyncInvocation: true,
        },
      });
    });
  });
});
