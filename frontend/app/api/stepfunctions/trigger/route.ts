import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const response = await sfnClient.send(command);

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
        details: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    );
  }
}