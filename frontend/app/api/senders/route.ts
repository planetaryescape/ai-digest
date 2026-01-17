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

const aiSendersTable = process.env.DYNAMODB_TABLE_NAME || "ai-digest-known-ai-senders";
const nonAiSendersTable = process.env.NON_AI_SENDERS_TABLE || "ai-digest-known-non-ai-senders";

interface ExtendedSender extends KnownSender {
  classification?: "ai" | "non-ai";
}

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all, ai, non-ai

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return demo data when AWS credentials are not configured
      const demoSenders: ExtendedSender[] = [
        {
          senderEmail: "newsletter@openai.com",
          domain: "openai.com",
          senderName: "OpenAI",
          newsletterName: "OpenAI Newsletter",
          confirmedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 95,
          emailCount: 10,
          classification: "ai",
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
          classification: "ai",
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
          classification: "ai",
        },
        {
          senderEmail: "news@techcrunch.com",
          domain: "techcrunch.com",
          senderName: "TechCrunch",
          newsletterName: "TechCrunch Daily",
          confirmedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 45,
          emailCount: 20,
          classification: "non-ai",
        },
        {
          senderEmail: "marketing@company.com",
          domain: "company.com",
          senderName: "Company Marketing",
          newsletterName: "Marketing Updates",
          confirmedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 30,
          emailCount: 5,
          classification: "non-ai",
        },
      ];

      // Filter demo data based on query parameter
      const filteredData =
        filter === "all" ? demoSenders : demoSenders.filter((s) => s.classification === filter);

      return NextResponse.json(filteredData, { headers });
    }

    const docClient = getDocClient();
    const allSenders: ExtendedSender[] = [];

    // Fetch AI senders if needed
    if (filter === "all" || filter === "ai") {
      const aiCommand = new ScanCommand({
        TableName: aiSendersTable,
      });

      const aiResponse = await docClient.send(aiCommand);
      const aiSenders = (aiResponse.Items || []) as KnownSender[];
      allSenders.push(...aiSenders.map((s) => ({ ...s, classification: "ai" as const })));
    }

    // Fetch non-AI senders if needed
    if (filter === "all" || filter === "non-ai") {
      const nonAiCommand = new ScanCommand({
        TableName: nonAiSendersTable,
      });

      try {
        const nonAiResponse = await docClient.send(nonAiCommand);
        const nonAiSenders = (nonAiResponse.Items || []) as KnownSender[];
        allSenders.push(...nonAiSenders.map((s) => ({ ...s, classification: "non-ai" as const })));
      } catch (error) {
        // Non-AI table might not exist yet, log warning but continue
        console.warn("Non-AI senders table not accessible:", error);
      }
    }

    // Sort by confidence (descending) and then by email count (descending)
    allSenders.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return (b.emailCount || 0) - (a.emailCount || 0);
    });

    return NextResponse.json(allSenders, { headers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("ResourceNotFoundException")) {
        return NextResponse.json(
          {
            error: "DynamoDB table not found",
            details: `Tables '${aiSendersTable}' or '${nonAiSendersTable}' do not exist in region ${process.env.AWS_REGION || "us-east-1"}`,
            aiSendersTable,
            nonAiSendersTable,
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

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
      TableName: aiSendersTable,
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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

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
          [aiSendersTable]: deleteRequests,
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
