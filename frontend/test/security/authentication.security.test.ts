import { auth } from "@clerk/nextjs/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as triggerDigest } from "@/app/api/digest/trigger/route";
import { GET as getExecutions } from "@/app/api/stepfunctions/executions/route";
import { GET as getStatus } from "@/app/api/stepfunctions/status/route";
import { POST as triggerStepFunctions } from "@/app/api/stepfunctions/trigger/route";

vi.mock("@clerk/nextjs/server");
vi.mock("@aws-sdk/client-sfn");
vi.mock("@aws-sdk/client-lambda");

describe("Authentication Security Tests", () => {
  beforeEach(() => {
    process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN =
      "arn:aws:states:us-east-1:123456789012:stateMachine:test";
    process.env.LAMBDA_DIGEST_FUNCTION_NAME = "test-function";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Bypass Attempts", () => {
    it("blocks unauthenticated access to /api/stepfunctions/trigger", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

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
      vi.mocked(auth).mockResolvedValue({ userId: "" } as any);

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks unauthenticated access to /api/stepfunctions/status", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request(
        "http://localhost:3000/api/stepfunctions/status?executionArn=test"
      );

      const response = await getStatus(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks unauthenticated access to /api/stepfunctions/executions", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request("http://localhost:3000/api/stepfunctions/executions");

      const response = await getExecutions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks unauthenticated access to /api/digest/trigger", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request("http://localhost:3000/api/digest/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerDigest(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("prevents authorization header bypass attempts", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake-token",
          "X-User-Id": "fake-user-id",
          "X-Admin": "true",
        },
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("prevents cookie injection bypass attempts", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request("http://localhost:3000/api/digest/trigger", {
        method: "POST",
        headers: {
          Cookie: "__session=fake-session; __clerk_db_jwt=fake-jwt",
        },
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerDigest(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks requests with undefined auth response", async () => {
      vi.mocked(auth).mockResolvedValue(undefined as any);

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("blocks requests when auth throws an error", async () => {
      vi.mocked(auth).mockRejectedValue(new Error("Auth service unavailable"));

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to start Step Functions pipeline");
    });
  });

  describe("Authorization Checks", () => {
    it("does not expose sensitive information in error messages", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "test-user" } as any);

      // Mock AWS error with sensitive information
      const { SFNClient } = await import("@aws-sdk/client-sfn");
      vi.mocked(SFNClient).mockImplementation(
        () =>
          ({
            send: vi
              .fn()
              .mockRejectedValue(
                new Error("User arn:aws:iam::123456789012:user/admin does not have permission")
              ),
          }) as any
      );

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to start Step Functions pipeline");
      expect(data.details).not.toContain("123456789012");
      expect(data.details).not.toContain("admin");
    });

    it("prevents execution ARN injection in status endpoint", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "test-user" } as any);

      const maliciousArn = "../../../etc/passwd";
      const request = new Request(
        `http://localhost:3000/api/stepfunctions/status?executionArn=${encodeURIComponent(maliciousArn)}`
      );

      const response = await getStatus(request);

      // Should attempt to use the ARN but AWS SDK will handle validation
      expect(response.status).toBe(500);
    });

    it("validates and sanitizes input parameters", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "test-user" } as any);

      const request = new Request(
        "http://localhost:3000/api/stepfunctions/executions?status=INVALID_STATUS&maxResults=999999"
      );

      const response = await getExecutions(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid query parameters");
    });

    it("does not allow privilege escalation through userId manipulation", async () => {
      // First call with regular user
      vi.mocked(auth).mockResolvedValue({ userId: "regular-user" } as any);

      const request1 = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        body: JSON.stringify({
          cleanup: false,
          // Attempt to inject admin privileges
          triggeredBy: "admin-user",
          isAdmin: true,
        }),
      });

      const { SFNClient, StartExecutionCommand } = await import("@aws-sdk/client-sfn");
      const mockSend = vi.fn().mockResolvedValue({
        executionArn: "test-arn",
        startDate: new Date(),
      });

      vi.mocked(SFNClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any
      );

      await triggerStepFunctions(request1);

      // Verify the triggeredBy is set from auth, not from request body
      const command = mockSend.mock.calls[0][0];
      const input = JSON.parse(command.input.input);
      expect(input.triggeredBy).toBe("regular-user"); // Should use auth userId
      expect(input.isAdmin).toBeUndefined(); // Should not include injected field
    });
  });

  describe("Rate Limiting and DoS Prevention", () => {
    it("handles rapid repeated requests gracefully", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "test-user" } as any);

      const requests = Array.from(
        { length: 100 },
        () => new Request("http://localhost:3000/api/stepfunctions/executions")
      );

      const responses = await Promise.all(requests.map((req) => getExecutions(req)));

      // All requests should complete (no rate limiting implemented yet)
      responses.forEach((response) => {
        expect([200, 500]).toContain(response.status);
      });
    });

    it("validates maxResults to prevent resource exhaustion", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "test-user" } as any);

      const { SFNClient, ListExecutionsCommand } = await import("@aws-sdk/client-sfn");
      const mockSend = vi.fn().mockResolvedValue({ executions: [] });

      vi.mocked(SFNClient).mockImplementation(
        () =>
          ({
            send: mockSend,
          }) as any
      );

      // Attempt to request excessive results
      const request = new Request(
        "http://localhost:3000/api/stepfunctions/executions?maxResults=10000"
      );

      await getExecutions(request);

      // Verify maxResults is capped
      const command = mockSend.mock.calls[0][0];
      expect(command.input.maxResults).toBeLessThanOrEqual(100);
    });
  });

  describe("CORS and Origin Validation", () => {
    it("does not expose sensitive headers in responses", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = new Request("http://localhost:3000/api/stepfunctions/trigger", {
        method: "POST",
        headers: {
          Origin: "https://evil.com",
        },
        body: JSON.stringify({ cleanup: false }),
      });

      const response = await triggerStepFunctions(request);

      // Should not include sensitive headers
      expect(response.headers.get("X-Powered-By")).toBeNull();
      expect(response.headers.get("Server")).toBeNull();
    });
  });
});
