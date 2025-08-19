import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import type { KnownSender } from "@/types/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createDynamoDBClient() {
  const region = process.env.AWS_REGION || "us-east-1";
  console.log("Creating DynamoDB client for region:", region);

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("AWS credentials not configured");
    throw new Error("AWS credentials not configured");
  }

  return new DynamoDBClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

let client: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient() {
  if (!docClient) {
    client = createDynamoDBClient();
    docClient = DynamoDBDocumentClient.from(client);
  }
  return docClient;
}

const tableName = process.env.DYNAMODB_TABLE_NAME || "ai-digest-known-ai-senders";

export async function GET(request: NextRequest) {
  console.log("GET /api/senders - Start");

  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      console.log("GET /api/senders - Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error("AWS credentials not configured");
      return NextResponse.json(
        {
          error: "AWS credentials not configured",
          details: "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.",
          missingVars: {
            AWS_ACCESS_KEY_ID: !process.env.AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY: !process.env.AWS_SECRET_ACCESS_KEY,
          },
        },
        { status: 500, headers }
      );
    }

    console.log("Scanning DynamoDB table:", tableName);
    const docClient = getDocClient();
    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await docClient.send(command);
    console.log("DynamoDB scan successful, items:", response.Items?.length || 0);

    const senders = response.Items as KnownSender[];
    return NextResponse.json(senders || [], { headers });
  } catch (error) {
    console.error("Error fetching senders:", error);

    if (error instanceof Error) {
      if (error.message.includes("ResourceNotFoundException")) {
        return NextResponse.json(
          {
            error: "DynamoDB table not found",
            details: `Table '${tableName}' does not exist in region ${process.env.AWS_REGION || "us-east-1"}`,
            tableName,
            region: process.env.AWS_REGION || "us-east-1",
          },
          { status: 500, headers }
        );
      }

      if (
        error.message.includes("UnrecognizedClientException") ||
        error.message.includes("InvalidSignatureException")
      ) {
        return NextResponse.json(
          {
            error: "Invalid AWS credentials",
            details: "The provided AWS credentials are invalid or expired",
          },
          { status: 500, headers }
        );
      }

      if (error.message.includes("AccessDeniedException")) {
        return NextResponse.json(
          {
            error: "Access denied",
            details: "The AWS credentials do not have permission to access DynamoDB",
          },
          { status: 500, headers }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch senders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("POST /api/senders - Start");

  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { error: "AWS credentials not configured" },
        { status: 500, headers }
      );
    }

    const body = await request.json();
    const { email, name, newsletterName, confidence = 90 } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400, headers });
    }

    const domain = email.split("@")[1] || "";
    const now = new Date().toISOString();

    const newSender: KnownSender = {
      senderEmail: email.toLowerCase(),
      domain,
      senderName: name,
      newsletterName,
      confirmedAt: now,
      lastSeen: now,
      confidence,
      emailCount: 1,
    };

    console.log("Adding sender to DynamoDB:", newSender.senderEmail);
    const docClient = getDocClient();
    const command = new PutCommand({
      TableName: tableName,
      Item: newSender,
    });

    await docClient.send(command);
    console.log("Sender added successfully");

    return NextResponse.json(
      {
        success: true,
        sender: newSender,
      },
      { headers }
    );
  } catch (error) {
    console.error("Error adding sender:", error);
    return NextResponse.json(
      {
        error: "Failed to add sender",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}

export async function DELETE(request: NextRequest) {
  console.log("DELETE /api/senders - Start");

  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json(
        { error: "AWS credentials not configured" },
        { status: 500, headers }
      );
    }

    const body = await request.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400, headers });
    }

    console.log("Deleting senders:", emails);
    const docClient = getDocClient();

    const batchSize = 25;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const deleteRequests = batch.map((email: string) => ({
        DeleteRequest: {
          Key: {
            senderEmail: email.toLowerCase(),
          },
        },
      }));

      const command = new BatchWriteCommand({
        RequestItems: {
          [tableName]: deleteRequests,
        },
      });

      await docClient.send(command);
    }

    console.log("Senders deleted successfully");
    return NextResponse.json(
      {
        success: true,
        deleted: emails.length,
      },
      { headers }
    );
  } catch (error) {
    console.error("Error deleting senders:", error);
    return NextResponse.json(
      {
        error: "Failed to delete senders",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
