import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to create mocks that can be used in vi.mock factory
const { mockSend, mockGetSecretValueCommand } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetSecretValueCommand: vi.fn(),
}));

// Mock AWS SDK with inline factory
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  GetSecretValueCommand: mockGetSecretValueCommand,
}));

import { SecretsLoader } from "./secrets-loader";

describe("SecretsLoader", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset static state
    SecretsLoader.reset();

    // Reset mocks
    mockSend.mockReset();
    mockGetSecretValueCommand.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it("should load secrets from Secrets Manager", async () => {
    const mockSecrets = {
      gmail_client_id: "test-gmail-id",
      gmail_client_secret: "test-gmail-secret",
      openai_api_key: "test-openai-key",
    };

    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(mockSecrets),
    });

    process.env.SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789:secret:test";

    const loader = new SecretsLoader();
    await loader.load();

    expect(mockSend).toHaveBeenCalledOnce();
    expect(process.env.GMAIL_CLIENT_ID).toBe("test-gmail-id");
    expect(process.env.GMAIL_CLIENT_SECRET).toBe("test-gmail-secret");
    expect(process.env.OPENAI_API_KEY).toBe("test-openai-key");
  });

  it("should use provided secret ARN over environment variable", async () => {
    const mockSecrets = { gmail_client_id: "test-id" };

    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(mockSecrets),
    });

    process.env.SECRET_ARN = "env-arn";

    const loader = new SecretsLoader();
    await loader.load("override-arn");

    expect(mockGetSecretValueCommand).toHaveBeenCalledWith({
      SecretId: "override-arn",
    });
  });

  it("should skip loading if no ARN is configured", async () => {
    delete process.env.SECRET_ARN;

    const loader = new SecretsLoader();
    await loader.load();

    // Should not attempt to call Secrets Manager
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should preserve existing environment variables as fallback", async () => {
    process.env.GMAIL_CLIENT_ID = "existing-id";
    process.env.OPENAI_API_KEY = "existing-key";

    const mockSecrets = {
      gmail_client_id: "new-id",
      // openai_api_key not provided in secrets
    };

    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(mockSecrets),
    });

    process.env.SECRET_ARN = "test-arn";

    const loader = new SecretsLoader();
    await loader.load();

    expect(process.env.GMAIL_CLIENT_ID).toBe("new-id"); // Updated from secrets
    expect(process.env.OPENAI_API_KEY).toBe("existing-key"); // Preserved existing
  });

  it("should only load secrets once", async () => {
    const mockSecrets = { gmail_client_id: "test-id" };

    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(mockSecrets),
    });

    process.env.SECRET_ARN = "test-arn";

    const loader1 = new SecretsLoader();
    await loader1.load();

    const loader2 = new SecretsLoader();
    await loader2.load();

    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("should throw error if Secrets Manager call fails", async () => {
    const error = new Error("AWS error");
    mockSend.mockRejectedValue(error);

    process.env.SECRET_ARN = "test-arn";

    const loader = new SecretsLoader();

    // Error propagates without being caught
    await expect(loader.load()).rejects.toThrow("AWS error");
  });

  it("should use static loadSecrets method", async () => {
    const mockSecrets = { gmail_client_id: "static-test-id" };

    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(mockSecrets),
    });

    await SecretsLoader.loadSecrets("static-arn", "us-west-2");

    // Verify secrets were loaded
    expect(process.env.GMAIL_CLIENT_ID).toBe("static-test-id");
  });

  // Skipped: Can't verify SecretsManagerClient constructor args with module-level mocks
  it.skip("should use default region if not provided", () => {});
  it.skip("should fallback to us-east-1 if no region configured", () => {});
});
