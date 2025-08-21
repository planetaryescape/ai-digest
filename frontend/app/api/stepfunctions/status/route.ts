import { SFNClient, DescribeExecutionCommand } from "@aws-sdk/client-sfn";
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

    let output = null;
    if (response.output) {
      try {
        output = JSON.parse(response.output);
      } catch {
        output = response.output;
      }
    }

    return NextResponse.json({
      executionArn: response.executionArn,
      name: response.name,
      status: response.status,
      startDate: response.startDate,
      stopDate: response.stopDate,
      input: response.input ? JSON.parse(response.input) : null,
      output,
      error: response.error,
      cause: response.cause,
    });
  } catch (error) {
    console.error("Error getting execution status:", error);
    return NextResponse.json(
      { 
        error: "Failed to get execution status",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}