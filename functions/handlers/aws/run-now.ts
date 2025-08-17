import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

/**
 * AWS Lambda handler for manual trigger
 * Invokes the weekly-digest Lambda function
 * Supports cleanup mode when cleanup=true is passed in query params or body
 */
async function handler(
  event: APIGatewayProxyEvent | any,
  _context: Context
): Promise<APIGatewayProxyResult> {
  console.log("Manual digest run triggered");
  console.log("Event:", JSON.stringify(event));

  // Check for cleanup flag in various places
  let isCleanupMode = false;

  // Direct invocation - event is the raw payload
  if (event.cleanup === true) {
    isCleanupMode = true;
  }

  // API Gateway - check query string parameters
  if (event.queryStringParameters?.cleanup === "true") {
    isCleanupMode = true;
  }

  // API Gateway - check body if it's JSON
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.cleanup === true) {
        isCleanupMode = true;
      }
    } catch {
      // Not JSON, ignore
    }
  }

  console.log(`Running in ${isCleanupMode ? "cleanup" : "weekly"} mode`);

  const lambdaClient = new LambdaClient({
    region: process.env.AWS_REGION || "us-east-1",
  });

  const weeklyDigestFunctionName = process.env.WEEKLY_DIGEST_FUNCTION_NAME;
  if (!weeklyDigestFunctionName) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Weekly digest Lambda function name not configured",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  try {
    // For cleanup mode, use async invocation since it can take a long time
    const invocationType = isCleanupMode ? "Event" : "RequestResponse";

    // Invoke the weekly-digest Lambda function
    const command = new InvokeCommand({
      FunctionName: weeklyDigestFunctionName,
      InvocationType: invocationType,
      Payload: JSON.stringify({
        httpMethod: "POST", // Indicate this is an HTTP-triggered invocation
        source: "manual",
        cleanup: isCleanupMode, // Pass cleanup flag to weekly-digest
      }),
    });

    const response = await lambdaClient.send(command);

    // Parse the response from weekly-digest (only for synchronous invocations)
    let digestResponse: any = {};
    if (invocationType === "RequestResponse" && response.Payload) {
      const payloadString = new TextDecoder().decode(response.Payload);
      try {
        digestResponse = JSON.parse(payloadString);
      } catch {
        digestResponse = { message: payloadString };
      }
    } else if (invocationType === "Event") {
      // For async invocation, we don't get the result immediately
      digestResponse = {
        message: "Cleanup digest started asynchronously. Check CloudWatch logs for progress.",
        asyncInvocation: true,
      };
    }

    // Check if the invocation was successful
    const success =
      response.StatusCode === 202 || (response.StatusCode === 200 && !response.FunctionError);

    console.log(`Weekly-digest invocation ${success ? "succeeded" : "failed"} (${invocationType})`);

    return {
      statusCode: success ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success,
        mode: isCleanupMode ? "cleanup" : "weekly",
        weeklyDigestResponse: digestResponse,
        timestamp: new Date().toISOString(),
        invocationId: _context.awsRequestId,
      }),
    };
  } catch (error) {
    console.error("Error invoking weekly-digest Lambda", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to invoke weekly-digest function";

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        invocationId: _context.awsRequestId,
      }),
    };
  }
}

// Export for Lambda
export { handler };
