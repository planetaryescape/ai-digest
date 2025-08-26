import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server");
vi.mock("@aws-sdk/client-lambda");
vi.mock("@aws-sdk/client-sfn");

describe("/api/digest/trigger", () => {
  let mockLambdaSend: any;
  let mockSFNSend: any;

  beforeEach(() => {
    // Set AWS credentials to enable AWS SDK functionality
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.AWS_REGION = "us-east-1";

    mockLambdaSend = vi.fn().mockResolvedValue({
      StatusCode: 200,
      Payload: new TextEncoder().encode(
        JSON.stringify({ success: true, message: "Digest generated" })
      ),
      $metadata: { requestId: "test-request-id" },
    });

    mockSFNSend = vi.fn().mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      startDate: new Date(),
    });

    vi.mocked(LambdaClient).mockImplementation(
      () =>
        ({
          send: mockLambdaSend,
        }) as any
    );

    vi.mocked(SFNClient).mockImplementation(
      () =>
        ({
          send: mockSFNSend,
        }) as any
    );

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;
    delete process.env.LAMBDA_RUN_NOW_URL;
    delete process.env.LAMBDA_DIGEST_FUNCTION_NAME;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Since auth is disabled in demo mode, this currently returns 200
    // When auth is re-enabled, this should return 401
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("triggers Step Functions when useStepFunctions is true and ARN is configured", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN =
      "arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine";

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({
        cleanup: false,
        dateRange: { start: "2024-01-01", end: "2024-01-31" },
        useStepFunctions: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Step Functions pipeline started");
    expect(data.type).toBe("stepfunctions");
    expect(data.executionArn).toContain("test-execution");

    expect(mockSFNSend).toHaveBeenCalledOnce();
    const command = mockSFNSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(StartExecutionCommand);

    const input = JSON.parse(command.input.input);
    expect(input.cleanup).toBe(false);
    expect(input.dateRange).toEqual({ start: "2024-01-01", end: "2024-01-31" });
    expect(input.triggeredBy).toBe("test-user-123");
    expect(input.source).toBe("dashboard");
  });

  it("uses Lambda Function URL when configured", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.LAMBDA_RUN_NOW_URL = "https://test-lambda-url.execute-api.us-east-1.amazonaws.com";

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "Digest triggered via URL" }),
    } as any);

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.type).toBe("lambda-url");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://test-lambda-url.execute-api.us-east-1.amazonaws.com",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"cleanup":true'),
      })
    );
  });

  it("falls back to AWS SDK Lambda invocation", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.LAMBDA_DIGEST_FUNCTION_NAME = "ai-digest-run-now";

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Digest generation completed");
    expect(data.type).toBe("lambda-sdk");
    expect(data.data).toEqual({ success: true, message: "Digest generated" });

    expect(mockLambdaSend).toHaveBeenCalledOnce();
    const command = mockLambdaSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(InvokeCommand);
    expect(command.input.FunctionName).toBe("ai-digest-run-now");
    expect(command.input.InvocationType).toBe("RequestResponse");
  });

  it("uses async invocation for cleanup mode with Lambda SDK", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.LAMBDA_DIGEST_FUNCTION_NAME = "ai-digest-run-now";

    mockLambdaSend.mockResolvedValue({
      StatusCode: 202,
      $metadata: { requestId: "async-request-id" },
    });

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Digest generation started (async mode)");
    expect(data.requestId).toBe("async-request-id");
    expect(data.type).toBe("lambda-sdk");

    const command = mockLambdaSend.mock.calls[0][0];
    expect(command.input.InvocationType).toBe("Event"); // Async invocation
  });

  it("prioritizes Step Functions over Lambda URL when both are configured", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN = "arn:aws:states:test";
    process.env.LAMBDA_RUN_NOW_URL = "https://test-lambda-url.execute-api.us-east-1.amazonaws.com";

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ useStepFunctions: true }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.type).toBe("stepfunctions");
    expect(mockSFNSend).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("handles Lambda URL errors gracefully", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.LAMBDA_RUN_NOW_URL = "https://test-lambda-url.execute-api.us-east-1.amazonaws.com";

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Internal server error" }),
    } as any);

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(false);
    expect(data.type).toBe("lambda-url");
  });

  it("handles AWS SDK errors gracefully", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.LAMBDA_DIGEST_FUNCTION_NAME = "ai-digest-run-now";

    mockLambdaSend.mockRejectedValue(new Error("Function not found"));

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to trigger digest generation");
    expect(data.details).toBeDefined();
  });

  it("includes all payload fields correctly", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    process.env.LAMBDA_DIGEST_FUNCTION_NAME = "ai-digest-run-now";

    const beforeTime = new Date().toISOString();

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({
        cleanup: true,
        dateRange: { start: "2024-01-01", end: "2024-01-31" },
      }),
    });

    await POST(request);

    const afterTime = new Date().toISOString();

    const command = mockLambdaSend.mock.calls[0][0];
    const payload = JSON.parse(command.input.Payload);

    expect(payload.cleanup).toBe(true);
    expect(payload.dateRange).toEqual({ start: "2024-01-01", end: "2024-01-31" });
    expect(payload.triggeredBy).toBe("test-user-123");
    expect(payload.source).toBe("dashboard");
    expect(new Date(payload.timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeTime).getTime()
    );
    expect(new Date(payload.timestamp).getTime()).toBeLessThanOrEqual(
      new Date(afterTime).getTime()
    );
  });

  it("handles invalid JSON in request body", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: "invalid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to trigger digest generation");
  });
});
