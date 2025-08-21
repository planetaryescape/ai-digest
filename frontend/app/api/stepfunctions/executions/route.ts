import { SFNClient, ListExecutionsCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeError } from "@/lib/utils/error-handling";

export const runtime = "nodejs";

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || "us-east-1",
  // Let AWS SDK handle credentials via IAM roles or environment
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
  } : {}),
});

// Input validation schema
const querySchema = z.object({
  status: z.enum(["RUNNING", "SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]).optional(),
  maxResults: z.string().optional().default("10").transform((val) => {
    const num = parseInt(val);
    if (isNaN(num)) return 10;
    return Math.max(1, Math.min(num, 100));
  }),
  nextToken: z.string().optional(),
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
    
    // Validate query parameters
    const validationResult = querySchema.safeParse({
      status: searchParams.get("status") || undefined,
      maxResults: searchParams.get("maxResults") || "10",
      nextToken: searchParams.get("nextToken") || undefined,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { status: statusFilter, maxResults, nextToken } = validationResult.data;

    const command = new ListExecutionsCommand({
      stateMachineArn,
      statusFilter,
      maxResults: typeof maxResults === 'string' ? parseInt(maxResults) : maxResults,
      ...(nextToken && { nextToken }),
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
        details: sanitizeError(error)
      },
      { status: 500 }
    );
  }
}