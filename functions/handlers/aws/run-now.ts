import { InvokeCommand, Lambda } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { SecretsLoader } from "../../lib/aws/secrets-loader";

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
  // Load secrets from AWS Secrets Manager on cold start
  await SecretsLoader.loadSecrets();
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
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};

    // Check for different modes
    const cleanup = event.queryStringParameters?.cleanup === "true" || body.cleanup === true;

    const mode = body.mode || (cleanup ? "cleanup" : "weekly");

    // Historical mode parameters
    const startDate = body.startDate;
    const endDate = body.endDate;

    // Validate historical mode
    if (mode === "historical") {
      if (!startDate || !endDate) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
          body: JSON.stringify({
            success: false,
            error: "Historical mode requires startDate and endDate",
          }),
        };
      }

      // Basic date validation
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
          throw new Error("startDate must be before endDate");
        }
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
          body: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : "Invalid date parameters",
          }),
        };
      }
    }

    // Use async invocation for all requests to avoid timeout issues
    // Weekly digest processing can take 5+ minutes, longer than run-now's 30s timeout
    const invocationType = "Event";

    // Invoke the weekly-digest Lambda with appropriate parameters
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: invocationType,
      Payload: JSON.stringify({
        mode,
        cleanup,
        startDate,
        endDate,
        httpMethod: "POST",
        path: "/",
        queryStringParameters: event.queryStringParameters,
        headers: event.headers,
        body: event.body,
      }),
    });

    const result = await lambda.send(command);

    // All invocations are now async - return immediately with confirmation
    let message: string;
    if (mode === "historical") {
      message = `Historical digest processing started for ${startDate} to ${endDate}`;
    } else if (mode === "cleanup") {
      message = "Cleanup digest processing started asynchronously";
    } else {
      message = "Weekly digest processing started asynchronously";
    }

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
        mode,
        dateRange: mode === "historical" ? { start: startDate, end: endDate } : undefined,
        invocationId: context.awsRequestId,
        timestamp: new Date().toISOString(),
        note: "Processing started. Check CloudWatch logs for completion status.",
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to invoke weekly-digest Lambda";

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

// Export for Lambda
export { handler };
