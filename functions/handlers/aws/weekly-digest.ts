import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import type { ScheduledEvent, Context, APIGatewayProxyResult } from "aws-lambda";
import { DigestProcessor } from "../../core/digest-processor";
import { DynamoDBStorageClient } from "../../lib/aws/storage";
import { S3StorageClient } from "../../lib/aws/s3-storage";
import type { ILogger } from "../../lib/interfaces/logger";
import type { IStorageClient } from "../../lib/interfaces/storage";

/**
 * AWS CloudWatch logger implementation
 */
class CloudWatchLogger implements ILogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[${this.context}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[${this.context}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`[${this.context}] DEBUG:`, message, ...args);
  }
}

/**
 * Load secrets from AWS Secrets Manager
 */
async function loadSecrets(): Promise<void> {
  const secretArn = process.env.SECRET_ARN;
  if (!secretArn) {
    console.warn("SECRET_ARN not configured, using environment variables");
    return;
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || "us-east-1",
  });

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretArn,
    });
    const response = await client.send(command);
    
    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      
      // Set environment variables from secrets
      process.env.GMAIL_CLIENT_ID = secrets.gmail_client_id || process.env.GMAIL_CLIENT_ID;
      process.env.GMAIL_CLIENT_SECRET = secrets.gmail_client_secret || process.env.GMAIL_CLIENT_SECRET;
      process.env.GMAIL_REFRESH_TOKEN = secrets.gmail_refresh_token || process.env.GMAIL_REFRESH_TOKEN;
      process.env.OPENAI_API_KEY = secrets.openai_api_key || process.env.OPENAI_API_KEY;
      process.env.HELICONE_API_KEY = secrets.helicone_api_key || process.env.HELICONE_API_KEY;
      process.env.RESEND_API_KEY = secrets.resend_api_key || process.env.RESEND_API_KEY;
      process.env.RESEND_FROM = secrets.resend_from || process.env.RESEND_FROM;
    }
  } catch (error) {
    console.error("Failed to load secrets from Secrets Manager", error);
    throw error;
  }
}

/**
 * AWS Lambda handler for weekly digest
 * Can be triggered by EventBridge (scheduled) or API Gateway (HTTP)
 */
async function handler(
  event: ScheduledEvent | any = {},
  _context: Context | any = {}
): Promise<void | APIGatewayProxyResult> {
  try {
    console.log("Handler called with event:", JSON.stringify(event || {}));
    console.log("Context:", JSON.stringify(_context || {}));
  } catch (e) {
    console.error("Error logging inputs:", e);
  }
  
  const logger = new CloudWatchLogger("weekly-digest");
  logger.info("Lambda function invoked", { eventType: event?.source || "http" });

  // Load secrets on cold start
  if (!process.env.SECRETS_LOADED) {
    await loadSecrets();
    process.env.SECRETS_LOADED = "true";
  }

  // Use S3 storage if configured, otherwise use DynamoDB
  const storage: IStorageClient = process.env.STORAGE_TYPE === "s3" 
    ? new S3StorageClient() 
    : new DynamoDBStorageClient();
  const processor = new DigestProcessor({ storage, logger });

  // Check if cleanup mode is requested
  const isCleanupMode = event?.cleanup === true || event?.mode === "cleanup";
  
  try {
    const result = isCleanupMode 
      ? await processor.processCleanupDigest()
      : await processor.processWeeklyDigest();
    
    // If this is an HTTP request (from API Gateway), return a response
    if (event?.httpMethod) {
      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: result.success,
          message: result.message,
          mode: isCleanupMode ? "cleanup" : "weekly",
          details: {
            emailsFound: result.emailsFound,
            emailsProcessed: result.emailsProcessed,
            batches: result.batches,
            error: result.error,
          },
          timestamp: new Date().toISOString(),
        }),
      };
    }
    
    // For scheduled events, just log the result
    logger.info("Digest processing completed", result);
    
    // Throw error for scheduled events to mark as failed in CloudWatch
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
  } catch (error) {
    logger.error("Failed to process digest", error);
    
    // For HTTP requests, return error response
    if (event?.httpMethod) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      };
    }
    
    // Re-throw for scheduled events
    throw error;
  }
}

// Export for Lambda
export { handler };