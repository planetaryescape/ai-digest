import { InvokeCommand } from "@aws-sdk/client-lambda";
import { StartExecutionCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getLambdaClient, getSFNClient } from "@/lib/aws/clients";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { checkRateLimit } from "@/lib/rate-limiter";
import { sanitizeError } from "@/lib/utils/error-handling";

export const runtime = "nodejs";
export const maxDuration = 60;

const sfnCircuitBreaker = CircuitBreaker.getBreaker("stepfunctions-digest", {
  failureThreshold: 5,
  resetTimeout: 60000,
});

const lambdaCircuitBreaker = CircuitBreaker.getBreaker("lambda-digest", {
  failureThreshold: 5,
  resetTimeout: 60000,
});

const httpCircuitBreaker = CircuitBreaker.getBreaker("lambda-http", {
  failureThreshold: 5,
  resetTimeout: 60000,
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = checkRateLimit(userId, "digest-trigger");
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.retryAfter?.toString() || "3600",
          },
        }
      );
    }

    const body = await request.json();
    const { cleanup = false, dateRange, useStepFunctions = false } = body;

    const payload = {
      cleanup,
      dateRange,
      triggeredBy: userId,
      timestamp: new Date().toISOString(),
      source: "dashboard",
    };

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return demo response when AWS credentials are not configured
      return NextResponse.json({
        success: true,
        message: "Demo mode: Digest generation simulated (AWS credentials not configured)",
        data: {
          demo: true,
          payload,
          generatedAt: new Date().toISOString(),
          estimatedCompletion: new Date(Date.now() + 120000).toISOString(), // 2 minutes from now
        },
        type: "demo",
      });
    }

    // Use Step Functions if requested and configured
    if (useStepFunctions && process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN) {
      const executionName = `digest-${Date.now()}-${userId.slice(-6)}`;

      const command = new StartExecutionCommand({
        stateMachineArn: process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN,
        name: executionName,
        input: JSON.stringify(payload),
      });

      const sfnClient = getSFNClient();

      const response = await sfnCircuitBreaker.execute(async () => {
        return await sfnClient.send(command);
      });

      return NextResponse.json({
        success: true,
        message: "Step Functions pipeline started",
        executionArn: response.executionArn,
        executionName,
        startDate: response.startDate,
        type: "stepfunctions",
      });
    }

    // Use Lambda Function URL if available
    const functionUrl = process.env.LAMBDA_RUN_NOW_URL;

    if (functionUrl) {
      // Direct HTTP call to Lambda Function URL with circuit breaker
      const response = await httpCircuitBreaker.execute(async () => {
        return await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      });

      const data = await response.json();

      return NextResponse.json({
        success: response.ok,
        message: data.message || "Digest generation triggered via Function URL",
        data,
        type: "lambda-url",
      });
    }

    // Fallback to AWS SDK invocation
    const command = new InvokeCommand({
      FunctionName: process.env.LAMBDA_DIGEST_FUNCTION_NAME,
      InvocationType: cleanup ? "Event" : "RequestResponse",
      Payload: JSON.stringify(payload),
    });

    const lambda = getLambdaClient();

    const response = await lambdaCircuitBreaker.execute(async () => {
      return await lambda.send(command);
    });

    if (response.StatusCode === 202) {
      return NextResponse.json({
        success: true,
        message: "Digest generation started (async mode)",
        requestId: response.$metadata.requestId,
        type: "lambda-sdk",
      });
    }

    const responsePayload = response.Payload
      ? JSON.parse(new TextDecoder().decode(response.Payload))
      : null;

    return NextResponse.json({
      success: true,
      message: "Digest generation completed",
      data: responsePayload,
      type: "lambda-sdk",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to trigger digest generation",
        details: sanitizeError(error),
      },
      { status: 500 }
    );
  }
}
