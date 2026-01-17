import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { auth } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DigestPrompt {
  promptId: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  category: "analysis" | "criticism" | "research" | "summary";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

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

const tableName = process.env.DIGEST_PROMPTS_TABLE || "ai-digest-digest-prompts";

// Default prompts for demo mode
const defaultPrompts: DigestPrompt[] = [
  {
    promptId: "analysis-main",
    name: "Main Analysis Prompt",
    description: "Primary prompt for analyzing AI/tech newsletter content",
    template: `Analyze this AI/tech newsletter content and provide:
1. A concise title (max 10 words)
2. Key insights (2-3 bullet points)
3. Why this matters (1-2 sentences)
4. Action items for the reader

Email subject: {{subject}}
Content: {{content}}

Focus on practical implications for {{role}} professionals.
Highlight opportunities in {{industry}} sector.`,
    variables: ["subject", "content", "role", "industry"],
    category: "analysis",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
  {
    promptId: "criticism-main",
    name: "Critic Analysis Prompt",
    description: "Prompt for critical analysis and opinion generation",
    template: `Provide an opinionated take on this AI development:

Title: {{title}}
Summary: {{summary}}

Consider:
- Potential risks and downsides
- Overhyped claims vs reality
- Impact on {{industry}}
- Contrarian perspectives

Be constructive but critical. Maximum 3 paragraphs.`,
    variables: ["title", "summary", "industry"],
    category: "criticism",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
  },
];

export async function GET(request: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("promptId");

    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_ACCESS_KEY_ID === "your_aws_access_key_id"
    ) {
      // Return demo data when AWS credentials are not configured
      if (promptId) {
        const prompt = defaultPrompts.find((p) => p.promptId === promptId);
        if (!prompt) {
          return NextResponse.json({ error: "Prompt not found" }, { status: 404, headers });
        }
        return NextResponse.json({ ...prompt, _demoMode: true }, { headers });
      }
      return NextResponse.json({ prompts: defaultPrompts, _demoMode: true }, { headers });
    }

    const docClient = getDocClient();

    if (promptId) {
      // Get specific prompt
      const command = new GetCommand({
        TableName: tableName,
        Key: { promptId },
      });

      const response = await docClient.send(command);

      if (!response.Item) {
        return NextResponse.json({ error: "Prompt not found" }, { status: 404, headers });
      }

      return NextResponse.json(response.Item as DigestPrompt, { headers });
    }
    // Get all prompts
    const command = new ScanCommand({
      TableName: tableName,
    });

    const response = await docClient.send(command);
    const prompts = response.Items as DigestPrompt[];

    // If no prompts exist, return defaults
    if (!prompts || prompts.length === 0) {
      return NextResponse.json(defaultPrompts, { headers });
    }

    return NextResponse.json(prompts, { headers });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("ResourceNotFoundException")) {
        // Table doesn't exist yet, return default prompts
        return NextResponse.json(defaultPrompts, { headers });
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch prompts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}

export async function POST(request: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const body = await request.json();
    const { promptId, name, description, template, variables, category, isActive = true } = body;

    if (!promptId || !name || !template || !category) {
      return NextResponse.json(
        { error: "Missing required fields: promptId, name, template, category" },
        { status: 400, headers }
      );
    }

    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY ||
      process.env.AWS_ACCESS_KEY_ID === "your_aws_access_key_id"
    ) {
      // Return mock success response when AWS credentials are not configured
      const newPrompt: DigestPrompt = {
        promptId,
        name,
        description,
        template,
        variables: variables || extractVariables(template),
        category,
        isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      return NextResponse.json(
        {
          success: true,
          prompt: newPrompt,
          _demoMode: true,
          message:
            "Demo mode: Changes are not persisted. Configure AWS credentials to save prompts.",
        },
        { headers }
      );
    }

    const docClient = getDocClient();

    // Check if prompt exists
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { promptId },
    });

    const existing = await docClient.send(getCommand);

    const now = new Date().toISOString();
    const newPrompt: DigestPrompt = {
      promptId,
      name,
      description,
      template,
      variables: variables || extractVariables(template),
      category,
      isActive,
      createdAt: existing.Item ? (existing.Item as DigestPrompt).createdAt : now,
      updatedAt: now,
      version: existing.Item ? (existing.Item as DigestPrompt).version + 1 : 1,
    };

    const putCommand = new PutCommand({
      TableName: tableName,
      Item: newPrompt,
    });

    await docClient.send(putCommand);

    return NextResponse.json(
      {
        success: true,
        prompt: newPrompt,
      },
      { headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save prompt",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("promptId");

    if (!promptId) {
      return NextResponse.json({ error: "promptId is required" }, { status: 400, headers });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return mock success response when AWS credentials are not configured
      return NextResponse.json(
        {
          success: true,
          deleted: promptId,
          demo: true,
        },
        { headers }
      );
    }

    const docClient = getDocClient();

    const command = new DeleteCommand({
      TableName: tableName,
      Key: { promptId },
    });

    await docClient.send(command);

    return NextResponse.json(
      {
        success: true,
        deleted: promptId,
      },
      { headers }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete prompt",
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
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// Helper function to extract variables from template
function extractVariables(template: string): string[] {
  const regex = /\{\{\s*(\w+)\s*\}\}/g;
  const variables = new Set<string>();
  let match = regex.exec(template);

  while (match !== null) {
    variables.add(match[1]);
    match = regex.exec(template);
  }

  return Array.from(variables);
}
