import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { compose, withCorrelationId, withLambdaLogging } from "../../lib/middleware";
import { createHttpHandler } from "../unified/AWSHandler";

/**
 * AWS Lambda handler for manual trigger
 * Uses unified handler architecture
 * Supports cleanup mode when cleanup=true is passed in query params or body
 */
const unifiedHandler = createHttpHandler();

function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  return unifiedHandler(event, context);
}

// Apply middleware
const handlerWithMiddleware = compose(withLambdaLogging, withCorrelationId)(handler);

// Export for Lambda
export { handlerWithMiddleware as handler };
