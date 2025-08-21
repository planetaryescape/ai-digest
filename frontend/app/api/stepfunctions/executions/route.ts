import { SFNClient, ListExecutionsCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stateMachineArn = process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN;
    
    if (!stateMachineArn) {
      return NextResponse.json(
        { error: "Step Functions state machine ARN not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || undefined;
    const maxResults = parseInt(searchParams.get("maxResults") || "10");

    const command = new ListExecutionsCommand({
      stateMachineArn,
      statusFilter: statusFilter as any,
      maxResults: Math.min(maxResults, 100),
    });

    const response = await sfnClient.send(command);

    const executions = response.executions?.map((exec) => ({
      executionArn: exec.executionArn,
      name: exec.name,
      status: exec.status,
      startDate: exec.startDate,
      stopDate: exec.stopDate,
    })) || [];

    return NextResponse.json({
      executions,
      nextToken: response.nextToken,
    });
  } catch (error) {
    console.error("Error listing executions:", error);
    return NextResponse.json(
      { 
        error: "Failed to list executions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}