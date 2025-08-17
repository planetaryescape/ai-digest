import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export interface SecretValues {
  gmail_client_id?: string;
  gmail_client_secret?: string;
  gmail_refresh_token?: string;
  openai_api_key?: string;
  helicone_api_key?: string;
  resend_api_key?: string;
  resend_from?: string;
}

/**
 * AWS Secrets Manager loader
 */
export class SecretsLoader {
  private static isLoaded = false;
  private client: SecretsManagerClient;

  constructor(region?: string) {
    this.client = new SecretsManagerClient({
      region: region || process.env.AWS_REGION || "us-east-1",
    });
  }

  /**
   * Load secrets from AWS Secrets Manager
   */
  async load(secretArn?: string): Promise<void> {
    // Skip if already loaded
    if (SecretsLoader.isLoaded) {
      return;
    }

    const arn = secretArn || process.env.SECRET_ARN;
    if (!arn) {
      console.warn("SECRET_ARN not configured, using environment variables");
      return;
    }

    try {
      const command = new GetSecretValueCommand({
        SecretId: arn,
      });
      const response = await this.client.send(command);

      if (response.SecretString) {
        const secrets = JSON.parse(response.SecretString) as SecretValues;
        this.setEnvironmentVariables(secrets);
        SecretsLoader.isLoaded = true;
      }
    } catch (error) {
      console.error("Failed to load secrets from Secrets Manager", error);
      throw error;
    }
  }

  /**
   * Set environment variables from secrets
   */
  private setEnvironmentVariables(secrets: SecretValues): void {
    // Set environment variables from secrets, preserving existing values as fallback
    process.env.GMAIL_CLIENT_ID = secrets.gmail_client_id || process.env.GMAIL_CLIENT_ID;
    process.env.GMAIL_CLIENT_SECRET =
      secrets.gmail_client_secret || process.env.GMAIL_CLIENT_SECRET;
    process.env.GMAIL_REFRESH_TOKEN =
      secrets.gmail_refresh_token || process.env.GMAIL_REFRESH_TOKEN;
    process.env.OPENAI_API_KEY = secrets.openai_api_key || process.env.OPENAI_API_KEY;
    process.env.HELICONE_API_KEY = secrets.helicone_api_key || process.env.HELICONE_API_KEY;
    process.env.RESEND_API_KEY = secrets.resend_api_key || process.env.RESEND_API_KEY;
    process.env.RESEND_FROM = secrets.resend_from || process.env.RESEND_FROM;
  }

  /**
   * Static method for easy loading
   */
  static async loadSecrets(secretArn?: string, region?: string): Promise<void> {
    const loader = new SecretsLoader(region);
    await loader.load(secretArn);
  }

  /**
   * Reset loaded state (useful for testing)
   */
  static reset(): void {
    SecretsLoader.isLoaded = false;
  }
}
