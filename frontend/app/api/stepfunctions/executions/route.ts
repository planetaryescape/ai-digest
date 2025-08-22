import { ListExecutionsCommand } from "@aws-sdk/client-sfn";
// import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSFNClient } from "@/lib/aws/clients";
import { sanitizeError } from "@/lib/utils/error-handling";

export const runtime = "nodejs";

// Input validation schema
const querySchema = z.object({
  status: z.enum(["RUNNING", "SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"]).optional(),
  maxResults: z
    .string()
    .optional()
    .default("10")
    .transform((val) => {
      const num = Number.parseInt(val, 10);
      if (Number.isNaN(num)) {
        return 10;
      }
      return Math.max(1, Math.min(num, 100));
    }),
  nextToken: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    // Auth temporarily disabled while Clerk is not configured
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return demo data when AWS credentials are not configured
      const demoExecutions = [
        {
          executionArn: "arn:aws:states:us-east-1:123456789012:execution:ai-digest-pipeline:demo-execution-1",
          name: "demo-execution-1",
          status: "SUCCEEDED",
          startDate: new Date(Date.now() - 3600000).toISOString(),
          stopDate: new Date(Date.now() - 3000000).toISOString(),
        },
        {
          executionArn: "arn:aws:states:us-east-1:123456789012:execution:ai-digest-pipeline:demo-execution-2",
          name: "demo-execution-2",
          status: "RUNNING",
          startDate: new Date(Date.now() - 600000).toISOString(),
          stopDate: null,
        },
      ];
      
      return NextResponse.json({
        executions: demoExecutions,
        nextToken: null,
        demo: true,
      });
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
      maxResults: typeof maxResults === "string" ? Number.parseInt(maxResults, 10) : maxResults,
      ...(nextToken && { nextToken }),
    });

    const sfnClient = getSFNClient();
    const response = await sfnClient.send(command);

    const executions =
      response.executions?.map((exec) => ({
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
    return NextResponse.json(
      {
        error: "Failed to list executions",
        details: sanitizeError(error),
      },
      { status: 500 }
    );
  }
}
