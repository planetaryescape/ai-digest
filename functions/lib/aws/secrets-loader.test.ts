import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecretsLoader } from "./secrets-loader";

// Mock AWS SDK
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn(),
  GetSecretValueCommand: vi.fn(),
}));

describe("SecretsLoader", () => {
  let mockSend: ReturnType<typeof vi.fn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset static state
    SecretsLoader.reset();

    // Setup mock
    mockSend = vi.fn();
    vi.mocked(SecretsManagerClient).mockImplementation(
      () =>
        ({
          send: mockSend,
        }) as any
    );

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

    expect(vi.mocked(GetSecretValueCommand)).toHaveBeenCalledWith({
      SecretId: "override-arn",
    });
  });

  it("should skip loading if no ARN is configured", async () => {
    delete process.env.SECRET_ARN;
    const consoleSpy = vi.spyOn(console, "warn");

    const loader = new SecretsLoader();
    await loader.load();

    expect(mockSend).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "SECRET_ARN not configured, using environment variables"
    );
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
    const consoleSpy = vi.spyOn(console, "error");

    const loader = new SecretsLoader();

    await expect(loader.load()).rejects.toThrow("AWS error");
    expect(consoleSpy).toHaveBeenCalledWith("Failed to load secrets from Secrets Manager", error);
  });

  it("should use static loadSecrets method", async () => {
    const mockSecrets = { gmail_client_id: "static-test-id" };

    mockSend.mockResolvedValue({
      SecretString: JSON.stringify(mockSecrets),
    });

    await SecretsLoader.loadSecrets("static-arn", "us-west-2");

    expect(vi.mocked(SecretsManagerClient)).toHaveBeenCalledWith({
      region: "us-west-2",
    });
    expect(process.env.GMAIL_CLIENT_ID).toBe("static-test-id");
  });

  it("should use default region if not provided", () => {
    process.env.AWS_REGION = "eu-west-1";

    new SecretsLoader();

    expect(vi.mocked(SecretsManagerClient)).toHaveBeenCalledWith({
      region: "eu-west-1",
    });
  });

  it("should fallback to us-east-1 if no region configured", () => {
    delete process.env.AWS_REGION;

    new SecretsLoader();

    expect(vi.mocked(SecretsManagerClient)).toHaveBeenCalledWith({
      region: "us-east-1",
    });
  });
});
