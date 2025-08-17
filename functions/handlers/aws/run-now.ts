import { InvokeCommand, Lambda } from "@aws-sdk/client-lambda";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import {
  compose,
  withCorrelationId,
  withLambdaLogging,
} from "../../lib/middleware";

/**
 * AWS Lambda handler for manual trigger
 * Invokes the weekly-digest Lambda function instead of processing directly
 * Supports cleanup mode when cleanup=true is passed in query params or body
 */
const lambda = new Lambda();

async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const functionName = process.env.WEEKLY_DIGEST_FUNCTION_NAME;

  if (!functionName) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        success: false,
        error: "Weekly digest Lambda function name not configured",
        timestamp: new Date().toISOString(),
        invocationId: context.awsRequestId,
      }),
    };
  }

  try {
    // Check for cleanup mode
    const cleanup =
      event.queryStringParameters?.cleanup === "true" ||
      (event.body && JSON.parse(event.body || "{}").cleanup === true);

    // Determine invocation type based on cleanup mode
    const invocationType = cleanup ? "Event" : "RequestResponse";

    // biome-ignore lint: Lambda logging is appropriate here
    console.log(
      `Invoking ${functionName} with invocationType: ${invocationType}, cleanup: ${cleanup}`
    );

    // Invoke the weekly-digest Lambda
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: invocationType,
      Payload: JSON.stringify({
        cleanup,
        httpMethod: "POST",
        path: "/",
        queryStringParameters: event.queryStringParameters,
        headers: event.headers,
        body: event.body,
      }),
    });

    const result = await lambda.send(command);

    // For async invocation (cleanup mode), return immediately
    if (invocationType === "Event") {
      return {
        statusCode: 202,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({
          success: true,
          message: "Cleanup digest processing started asynchronously",
          invocationId: context.awsRequestId,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // For sync invocation, parse and return the response
    const responsePayload = result.Payload
      ? JSON.parse(new TextDecoder().decode(result.Payload))
      : { success: false, error: "No response payload" };

    return {
      statusCode: result.StatusCode || 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        success: true,
        weeklyDigestResponse: responsePayload,
        invocationId: context.awsRequestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to invoke weekly-digest Lambda";

    // biome-ignore lint: Lambda error logging is appropriate here
    console.log(`Error invoking weekly-digest Lambda: ${errorMessage}`);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        invocationId: context.awsRequestId,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

// Apply middleware
const handlerWithMiddleware = compose(
  withLambdaLogging,
  withCorrelationId
)(handler);

// Export for Lambda
export { handlerWithMiddleware as handler };
