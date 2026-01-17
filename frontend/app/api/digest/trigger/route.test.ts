import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

// Mock auth function
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

// Mock Lambda client
const mockLambdaSend = vi.fn();
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({
    send: mockLambdaSend,
  })),
  InvokeCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

// Mock SFN client
const mockSFNSend = vi.fn();
vi.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: vi.fn().mockImplementation(() => ({
    send: mockSFNSend,
  })),
  StartExecutionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

describe("/api/digest/trigger", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    mockLambdaSend.mockReset();
    mockSFNSend.mockReset();

    // Set AWS credentials to enable AWS SDK functionality
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.AWS_REGION = "us-east-1";

    mockLambdaSend.mockResolvedValue({
      StatusCode: 200,
      Payload: new TextEncoder().encode(
        JSON.stringify({ success: true, message: "Digest generated" })
      ),
      $metadata: { requestId: "test-request-id" },
    });

    mockSFNSend.mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      startDate: new Date(),
    });

    originalFetch = global.fetch;
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
    delete process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;
    delete process.env.NEXT_PUBLIC_STEP_FUNCTIONS_STATE_MACHINE_ARN;
    delete process.env.LAMBDA_RUN_NOW_URL;
    delete process.env.LAMBDA_DIGEST_FUNCTION_NAME;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;
  });

  it("returns 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const request = new Request("http://localhost:3000/api/digest/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("triggers Step Functions when useStepFunctions is true and ARN is configured", async () => {
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
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
    expect(command.input).toBeDefined();

    const input = JSON.parse(command.input.input);
    expect(input.cleanup).toBe(false);
    expect(input.dateRange).toEqual({ start: "2024-01-01", end: "2024-01-31" });
    expect(input.triggeredBy).toBe("test-user-123");
    expect(input.source).toBe("dashboard");
  });

  it("uses Lambda Function URL when configured", async () => {
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
    process.env.LAMBDA_RUN_NOW_URL = "https://test-lambda-url.execute-api.us-east-1.amazonaws.com";

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: "Digest triggered via URL" }),
    });

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
      })
    );
  });

  it("falls back to AWS SDK Lambda invocation", async () => {
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
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
    expect(command.input.FunctionName).toBe("ai-digest-run-now");
    expect(command.input.InvocationType).toBe("RequestResponse");
  });

  it("uses async invocation for cleanup mode with Lambda SDK", async () => {
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
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
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
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
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
    process.env.LAMBDA_RUN_NOW_URL = "https://test-lambda-url.execute-api.us-east-1.amazonaws.com";

    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Internal server error" }),
    });

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
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
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
    mockAuth.mockResolvedValue({ userId: "test-user-123" });
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
    mockAuth.mockResolvedValue({ userId: "test-user-123" });

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
