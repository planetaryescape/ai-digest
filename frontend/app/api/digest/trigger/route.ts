import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const lambda = new LambdaClient({
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
    const { cleanup = false, dateRange } = body;

    const payload = {
      cleanup,
      dateRange,
      triggeredBy: userId,
      timestamp: new Date().toISOString(),
    };

    // Use Lambda Function URL if available
    const functionUrl = process.env.LAMBDA_RUN_NOW_URL;

    if (functionUrl) {
      // Direct HTTP call to Lambda Function URL
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      return NextResponse.json({
        success: response.ok,
        message: data.message || "Digest generation triggered via Function URL",
        data,
      });
    }

    // Fallback to AWS SDK invocation
    const command = new InvokeCommand({
      FunctionName: process.env.LAMBDA_DIGEST_FUNCTION_NAME,
      InvocationType: cleanup ? "Event" : "RequestResponse",
      Payload: JSON.stringify(payload),
    });

    const response = await lambda.send(command);

    if (response.StatusCode === 202) {
      return NextResponse.json({
        success: true,
        message: "Digest generation started (async mode)",
        requestId: response.$metadata.requestId,
      });
    }

    const responsePayload = response.Payload
      ? JSON.parse(new TextDecoder().decode(response.Payload))
      : null;

    return NextResponse.json({
      success: true,
      message: "Digest generation completed",
      data: responsePayload,
    });
  } catch (error) {
    console.error("Error triggering digest:", error);
    return NextResponse.json({ error: "Failed to trigger digest generation" }, { status: 500 });
  }
}
