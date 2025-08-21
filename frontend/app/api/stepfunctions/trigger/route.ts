import { StartExecutionCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/utils/error-handling";
import { getSFNClient } from "@/lib/aws/clients";
import { checkRateLimit } from "@/lib/rate-limiter";
import { CircuitBreaker } from "@/lib/circuit-breaker";

export const runtime = "nodejs";
export const maxDuration = 60;

const sfnCircuitBreaker = CircuitBreaker.getBreaker("stepfunctions", {
  failureThreshold: 5,
  resetTimeout: 60000,
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = checkRateLimit(userId, "stepfunctions-trigger");
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
    const { cleanup = false, dateRange, useStepFunctions = true } = body;

    const stateMachineArn = process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;
    
    if (!stateMachineArn) {
      return NextResponse.json(
        { error: "Step Functions state machine ARN not configured" },
        { status: 500 }
      );
    }

    const executionName = `digest-${Date.now()}-${userId.slice(-6)}`;
    const input = {
      cleanup,
      dateRange,
      triggeredBy: userId,
      timestamp: new Date().toISOString(),
      source: "dashboard",
    };

    const command = new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input: JSON.stringify(input),
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
    });
  } catch (error) {
    console.error("Error starting Step Functions execution:", error);
    return NextResponse.json(
      { 
        error: "Failed to start Step Functions pipeline",
        details: sanitizeError(error)
      }, 
      { status: 500 }
    );
  }
}