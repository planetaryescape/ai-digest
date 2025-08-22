import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@clerk/nextjs/server");
vi.mock("@aws-sdk/client-sfn");

describe("/api/stepfunctions/trigger", () => {
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSend = vi.fn().mockResolvedValue({
      executionArn:
        "arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution-123",
      startDate: new Date(),
    });

    vi.mocked(SFNClient).mockImplementation(
      () =>
        ({
          send: mockSend,
          config: {},
          destroy: vi.fn(),
          middlewareStack: {},
        }) as unknown as SFNClient
    );

    process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN =
      "arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({
      userId: null,
      sessionClaims: null,
      getToken: vi.fn(),
    } as ReturnType<typeof auth>);

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 500 when state machine ARN is not configured", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);
    delete process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Step Functions state machine ARN not configured");
  });

  it("starts Step Functions execution with correct parameters", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({
        cleanup: true,
        dateRange: { start: "2024-01-01", end: "2024-01-31" },
        useStepFunctions: true,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Step Functions pipeline started");
    expect(data.executionArn).toContain("test-execution");

    // Verify StartExecutionCommand was called with correct parameters
    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(StartExecutionCommand);

    const input = JSON.parse(command.input.input);
    expect(input.cleanup).toBe(true);
    expect(input.dateRange).toEqual({ start: "2024-01-01", end: "2024-01-31" });
    expect(input.triggeredBy).toBe("test-user-123");
    expect(input.source).toBe("dashboard");
  });

  it("generates unique execution names", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request1 = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const request2 = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    await POST(request1);
    await POST(request2);

    const executionName1 = mockSend.mock.calls[0][0].input.name;
    const executionName2 = mockSend.mock.calls[1][0].input.name;

    expect(executionName1).not.toBe(executionName2);
    expect(executionName1).toMatch(/^digest-\d+-\w{6}$/);
    expect(executionName2).toMatch(/^digest-\d+-\w{6}$/);
  });

  it("handles AWS SDK errors gracefully", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    mockSend.mockRejectedValue(new Error("AWS Service Error"));

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to start Step Functions pipeline");
    expect(data.details).toBeDefined();
  });

  it("includes timestamp in execution input", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const beforeTime = new Date().toISOString();

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    await POST(request);

    const afterTime = new Date().toISOString();

    const command = mockSend.mock.calls[0][0];
    const input = JSON.parse(command.input.input);

    expect(new Date(input.timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(beforeTime).getTime()
    );
    expect(new Date(input.timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
  });

  it("uses environment credentials when available", async () => {
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";

    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: JSON.stringify({ cleanup: false }),
    });

    await POST(request);

    expect(vi.mocked(SFNClient)).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: {
          accessKeyId: "test-access-key",
          secretAccessKey: "test-secret-key",
        },
      })
    );

    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it("handles invalid JSON in request body", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "test-user-123" } as any);

    const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
      method: "POST",
      body: "invalid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to start Step Functions pipeline");
  });
});
