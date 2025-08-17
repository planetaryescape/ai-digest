import type { Context } from "aws-lambda";
import { DigestProcessor } from "../../core/digest-processor";
import { CloudWatchLogger } from "../../lib/aws/cloudwatch-logger";
import { SecretsLoader } from "../../lib/aws/secrets-loader";
import { StorageFactory } from "../../lib/storage-factory";
import type { DigestLambdaResponse, DigestResponseBody, LambdaEvent } from "../../lib/types/lambda";

/**
 * AWS Lambda handler for weekly digest
 * Can be triggered by EventBridge (scheduled) or API Gateway (HTTP)
 */
async function handler(
  event: LambdaEvent = {} as LambdaEvent,
  _context: Context = {} as Context
): Promise<void | DigestLambdaResponse> {
  try {
    console.log("Handler called with event:", JSON.stringify(event || {}));
    console.log("Context:", JSON.stringify(_context || {}));
  } catch (e) {
    console.error("Error logging inputs:", e);
  }

  const logger = new CloudWatchLogger("weekly-digest");
  
  // Determine event type and mode
  const eventSource = 'source' in event ? event.source : 'httpMethod' in event ? 'http' : 'scheduled';
  logger.info("Lambda function invoked", { eventType: eventSource });

  // Load secrets on cold start
  await SecretsLoader.loadSecrets();

  // Create storage client based on configuration
  const storage = StorageFactory.create();
  const processor = new DigestProcessor({ storage, logger });

  // Check if cleanup mode is requested (checking all possible event types)
  const isCleanupMode = 
    ('cleanup' in event && event.cleanup === true) || 
    ('mode' in event && event.mode === "cleanup");

  try {
    const result = isCleanupMode
      ? await processor.processCleanupDigest()
      : await processor.processWeeklyDigest();

    // If this is an HTTP request (from API Gateway), return a response
    if ("httpMethod" in event && event.httpMethod) {
      const responseBody: DigestResponseBody = {
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
      };

      return {
        statusCode: result.success ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(responseBody),
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
    if ("httpMethod" in event && event.httpMethod) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorResponse: DigestResponseBody = {
        success: false,
        timestamp: new Date().toISOString(),
        details: {
          emailsFound: 0,
          emailsProcessed: 0,
          error: errorMessage,
        },
      };

      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(errorResponse),
      };
    }

    // Re-throw for scheduled events
    throw error;
  }
}

// Export for Lambda
export { handler };
