import { SFNClient, DescribeExecutionCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sanitizeError, safeJsonParse } from "@/lib/utils/error-handling";

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

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const executionArn = searchParams.get("executionArn");

    if (!executionArn) {
      return NextResponse.json(
        { error: "Execution ARN is required" },
        { status: 400 }
      );
    }

    const command = new DescribeExecutionCommand({
      executionArn,
    });

    const response = await sfnClient.send(command);

    // Safe JSON parsing with fallback
    const output = response.output ? safeJsonParse(response.output, response.output) : null;
    const input = response.input ? safeJsonParse(response.input, null) : null;

    return NextResponse.json({
      executionArn: response.executionArn,
      name: response.name,
      status: response.status,
      startDate: response.startDate,
      stopDate: response.stopDate,
      input,
      output,
      error: response.error,
      cause: response.cause,
    });
  } catch (error) {
    console.error("Error getting execution status:", error);
    return NextResponse.json(
      { 
        error: "Failed to get execution status",
        details: sanitizeError(error)
      },
      { status: 500 }
    );
  }
}