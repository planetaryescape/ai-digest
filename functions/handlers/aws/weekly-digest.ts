import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";
import { SecretsLoader } from "../../lib/aws/secrets-loader";
import { ConfigValidator } from "../../lib/config-validator";
import { compose, withCorrelationId, withLambdaLogging } from "../../lib/middleware";
import { createHttpHandler, createScheduledHandler } from "../unified/AWSHandler";

/**
 * AWS Lambda handler for weekly digest
 * Can be triggered by EventBridge (scheduled) or API Gateway (HTTP)
 * Uses unified handler architecture
 */
const httpHandler = createHttpHandler();
const scheduledHandler = createScheduledHandler();

async function handler(event: any, context: Context): Promise<APIGatewayProxyResult | undefined> {
  // Load secrets from AWS Secrets Manager on cold start
  try {
    await SecretsLoader.loadSecrets();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to load secrets";

    // Check if this is an HTTP event
    if (event.httpMethod) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `Failed to initialize: ${errorMessage}`,
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }

  // Validate configuration after secrets are loaded
  try {
    ConfigValidator.validateOrThrow();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Configuration validation failed";

    // Check if this is an HTTP event
    if (event.httpMethod) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }

  // Determine event type and route to appropriate handler
  const isScheduledEvent =
    event.source === "aws.events" && event["detail-type"] === "Scheduled Event";

  if (isScheduledEvent) {
    return scheduledHandler(event as ScheduledEvent, context);
  }
  return httpHandler(event as APIGatewayProxyEvent, context);
}

// Apply middleware for HTTP events
const handlerWithMiddleware = compose(
  withCorrelationId,
  // Only apply HTTP logging for actual HTTP events
  (h: any) => async (event: any, context: any) => {
    if (event.httpMethod) {
      return withLambdaLogging(h)(event, context);
    }
    return h(event, context);
  }
)(handler);

// Export for Lambda
export { handlerWithMiddleware as handler };
