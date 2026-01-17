import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as triggerDigest } from "@/app/api/digest/trigger/route";
import { GET as getExecutions } from "@/app/api/stepfunctions/executions/route";
import { GET as getStatus } from "@/app/api/stepfunctions/status/route";
import { POST as triggerStepFunctions } from "@/app/api/stepfunctions/trigger/route";

// Mock auth function
const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@aws-sdk/client-sfn", () => ({
  SFNClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  StartExecutionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  ListExecutionsCommand: vi.fn().mockImplementation((input: any) => ({ input })),
  DescribeExecutionCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  InvokeCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

describe("Authentication Security Tests", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    process.env.AWS_ACCESS_KEY_ID = "test-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN =
      "arn:aws:states:us-east-1:123456789012:stateMachine:test";
    process.env.LAMBDA_DIGEST_FUNCTION_NAME = "test-function";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Bypass Attempts", () => {
    it("blocks unauthenticated access to /api/stepfunctions/trigger", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks empty userId in /api/stepfunctions/trigger", async () => {
      mockAuth.mockResolvedValue({ userId: "" });

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks unauthenticated access to /api/stepfunctions/executions", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = new Request("http://localhost:3000/api/stepfunctions/executions");

      const response = await getExecutions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks unauthenticated access to /api/stepfunctions/status", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = new Request(
        "http://localhost:3000/api/stepfunctions/status?executionArn=test-arn"
      );

      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks unauthenticated access to /api/digest/trigger", async () => {
      mockAuth.mockResolvedValue({ userId: null });

      const request = new Request("http://localhost:3000/api/digest/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerDigest(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Authenticated Access", () => {
    it("allows authenticated access to /api/stepfunctions/trigger", async () => {
      mockAuth.mockResolvedValue({ userId: "test-user-123" });

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);

      // Should not return 401 for authenticated users
      expect(response.status).not.toBe(401);
    });

    it("allows authenticated access to /api/stepfunctions/executions", async () => {
      mockAuth.mockResolvedValue({ userId: "test-user-123" });

      const request = new Request("http://localhost:3000/api/stepfunctions/executions");

      const response = await getExecutions(request);

      expect(response.status).not.toBe(401);
    });

    it("allows authenticated access to /api/digest/trigger", async () => {
      mockAuth.mockResolvedValue({ userId: "test-user-123" });

      const request = new Request("http://localhost:3000/api/digest/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerDigest(request);

      expect(response.status).not.toBe(401);
    });
  });
});
