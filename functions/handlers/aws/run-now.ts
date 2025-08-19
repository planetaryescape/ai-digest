import { InvokeCommand, Lambda } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { compose, withCorrelationId, withLambdaLogging } from "../../lib/middleware";

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

    // Use async invocation for all requests to avoid timeout issues
    // Weekly digest processing can take 5+ minutes, longer than run-now's 30s timeout
    const invocationType = "Event";

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

    // All invocations are now async - return immediately with confirmation
    const message = cleanup
      ? "Cleanup digest processing started asynchronously"
      : "Weekly digest processing started asynchronously";

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
        message,
        mode: cleanup ? "cleanup" : "weekly",
        invocationId: context.awsRequestId,
        timestamp: new Date().toISOString(),
        note: "Processing started. Check CloudWatch logs for completion status.",
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to invoke weekly-digest Lambda";

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
const handlerWithMiddleware = compose(withLambdaLogging, withCorrelationId)(handler);

// Export for Lambda
export { handlerWithMiddleware as handler };
