import { InvokeCommand, Lambda } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { formatISO, parseISO } from "date-fns";
import { SecretsLoader } from "../../lib/aws/secrets-loader";
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
  // Load secrets from AWS Secrets Manager on cold start
  try {
    await SecretsLoader.loadSecrets();
  } catch (_error) {
    // Continue anyway as run-now doesn't need secrets directly
  }

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
        timestamp: formatISO(new Date()),
        invocationId: context.awsRequestId,
      }),
    };
  }

  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};

    // Check for different modes
    const cleanup = event.queryStringParameters?.cleanup === "true" || body.cleanup === true;
    const testMode = event.queryStringParameters?.test === "true" || body.test === true;
    const maxEmails = testMode ? 20 : undefined; // Limit to 20 emails in test mode

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
        const start = parseISO(startDate);
        const end = parseISO(endDate);
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
        ...(maxEmails && { maxEmails }),
        httpMethod: "POST",
        path: "/",
        queryStringParameters: event.queryStringParameters,
        headers: event.headers,
        body: event.body,
      }),
    });

    const _result = await lambda.send(command);

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
        timestamp: formatISO(new Date()),
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
        timestamp: formatISO(new Date()),
      }),
    };
  }
}

// Apply middleware
const handlerWithMiddleware = compose(withLambdaLogging, withCorrelationId)(handler);

// Export for Lambda
export { handlerWithMiddleware as handler };
