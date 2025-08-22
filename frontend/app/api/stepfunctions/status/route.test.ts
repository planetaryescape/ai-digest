import { DescribeExecutionCommand, SFNClient } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@clerk/nextjs/server");
vi.mock("@aws-sdk/client-sfn");

describe("/api/stepfunctions/status", () => {
  let mockSend: any;

  beforeEach(() => {
    mockSend = vi.fn().mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      name: "test-execution-123",
      status: "RUNNING",
      startDate: new Date("2024-01-01T12:00:00Z"),
      input: '{"cleanup": false, "dateRange": null}',
      output: null,
    });

    vi.mocked(SFNClient).mockImplementation(
      () =>
        ({
          send: mockSend,
        }) as any
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when executionArn is missing", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request = new Request("http://localhost:3000/api/stepfunctions/status");

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Execution ARN is required");
  });

  it("returns execution status for running execution", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("RUNNING");
    expect(data.name).toBe("test-execution-123");
    expect(data.executionArn).toContain("test-execution-123");
    expect(data.input).toEqual({ cleanup: false, dateRange: null });
    expect(data.output).toBeNull();
  });

  it("returns execution status for succeeded execution", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    mockSend.mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      name: "test-execution-123",
      status: "SUCCEEDED",
      startDate: new Date("2024-01-01T12:00:00Z"),
      stopDate: new Date("2024-01-01T12:05:00Z"),
      input: '{"cleanup": false}',
      output: '{"success": true, "emailsProcessed": 42}',
    });

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("SUCCEEDED");
    expect(data.stopDate).toBeDefined();
    expect(data.output).toEqual({ success: true, emailsProcessed: 42 });
  });

  it("returns execution status for failed execution", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    mockSend.mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      name: "test-execution-123",
      status: "FAILED",
      startDate: new Date("2024-01-01T12:00:00Z"),
      stopDate: new Date("2024-01-01T12:01:00Z"),
      input: '{"cleanup": false}',
      output: null,
      error: "States.TaskFailed",
      cause: "Lambda function failed",
    });

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("FAILED");
    expect(data.error).toBe("States.TaskFailed");
    expect(data.cause).toBe("Lambda function failed");
  });

  it("handles invalid JSON in input/output gracefully", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    mockSend.mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      name: "test-execution-123",
      status: "RUNNING",
      startDate: new Date("2024-01-01T12:00:00Z"),
      input: "invalid json {",
      output: "also invalid }",
    });

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("RUNNING");
    expect(data.input).toBeNull(); // Fallback to null on parse error
    expect(data.output).toBe("also invalid }"); // Fallback to original string
  });

  it("handles AWS SDK errors gracefully", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    mockSend.mockRejectedValue(new Error("ExecutionDoesNotExist"));

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=non-existent"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to get execution status");
    expect(data.details).toBeDefined();
  });

  it("sends correct DescribeExecutionCommand", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const executionArn =
      "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:specific-execution";
    const request = new Request(
      `http://localhost:3000/api/stepfunctions/status?executionArn=${encodeURIComponent(executionArn)}`
    );

    await GET(request);

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(DescribeExecutionCommand);
    expect(command.input.executionArn).toBe(executionArn);
  });

  it("handles aborted execution status", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    mockSend.mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      name: "test-execution-123",
      status: "ABORTED",
      startDate: new Date("2024-01-01T12:00:00Z"),
      stopDate: new Date("2024-01-01T12:02:00Z"),
      input: '{"cleanup": false}',
      output: null,
    });

    const request = new Request(
      "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ABORTED");
    expect(data.stopDate).toBeDefined();
  });
});
