import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
// import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import type { KnownSender } from "@/types/sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createDynamoDBClient() {
  const region = process.env.AWS_REGION || "us-east-1";

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
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

export async function GET(_request: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // Auth temporarily disabled while Clerk is not configured
    // if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    //   const { userId } = await auth();
    //   if (!userId) {
    //     return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    //   }
    // }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return demo data when AWS credentials are not configured
      const demoSenders: KnownSender[] = [
        {
          senderEmail: "newsletter@openai.com",
          domain: "openai.com",
          senderName: "OpenAI",
          newsletterName: "OpenAI Newsletter",
          confirmedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 95,
          emailCount: 10,
        },
        {
          senderEmail: "updates@anthropic.com",
          domain: "anthropic.com",
          senderName: "Anthropic",
          newsletterName: "Anthropic Updates",
          confirmedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 92,
          emailCount: 8,
        },
        {
          senderEmail: "digest@theverge.com",
          domain: "theverge.com",
          senderName: "The Verge",
          newsletterName: "The Verge AI Newsletter",
          confirmedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 88,
          emailCount: 15,
        },
      ];
      return NextResponse.json(demoSenders, { headers });
    }
    const docClient = getDocClient();
    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await docClient.send(command);

    const senders = response.Items as KnownSender[];
    return NextResponse.json(senders || [], { headers });
  } catch (error) {
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
  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // Auth temporarily disabled while Clerk is not configured
    // if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    //   const { userId } = await auth();
    //   if (!userId) {
    //     return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    //   }
    // }

    const body = await request.json();
    const { email, name, newsletterName, confidence = 90 } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400, headers });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return mock success response when AWS credentials are not configured
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

      return NextResponse.json(
        {
          success: true,
          sender: newSender,
          demo: true,
        },
        { headers }
      );
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
    const docClient = getDocClient();
    const command = new PutCommand({
      TableName: tableName,
      Item: newSender,
    });

    await docClient.send(command);

    return NextResponse.json(
      {
        success: true,
        sender: newSender,
      },
      { headers }
    );
  } catch (error) {
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
  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    // Auth temporarily disabled while Clerk is not configured
    // if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    //   const { userId } = await auth();
    //   if (!userId) {
    //     return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    //   }
    // }

    const body = await request.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400, headers });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return mock success response when AWS credentials are not configured
      return NextResponse.json(
        {
          success: true,
          deleted: emails.length,
          demo: true,
        },
        { headers }
      );
    }
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
    return NextResponse.json(
      {
        success: true,
        deleted: emails.length,
      },
      { headers }
    );
  } catch (error) {
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
