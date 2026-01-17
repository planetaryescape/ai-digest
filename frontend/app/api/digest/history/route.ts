import { DescribeExecutionCommand, ListExecutionsCommand } from "@aws-sdk/client-sfn";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSFNClient } from "@/lib/aws/clients";
import { sanitizeError } from "@/lib/utils/error-handling";

export const runtime = "nodejs";

interface DigestHistoryItem {
  executionArn: string;
  name: string;
  date: string;
  status: string;
  headline?: string;
  summary?: string;
  emailsProcessed?: number;
  aiEmails?: number;
  cost?: number;
  keyInsights?: string[];
  actionItems?: string[];
  duration?: number;
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "5", 10), 20);

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      // Return demo data when AWS credentials are not configured
      return NextResponse.json({
        digests: getDemoDigests(),
        demo: true,
      });
    }

    const stateMachineArn =
      process.env.STEP_FUNCTIONS_STATE_MACHINE_ARN ||
      process.env.NEXT_PUBLIC_STEP_FUNCTIONS_STATE_MACHINE_ARN;

    if (!stateMachineArn) {
      return NextResponse.json({
        digests: [],
        message: "Step Functions state machine ARN not configured",
      });
    }

    const sfnClient = getSFNClient();

    // List recent successful executions
    const listCommand = new ListExecutionsCommand({
      stateMachineArn,
      statusFilter: "SUCCEEDED",
      maxResults: limit,
    });

    const listResponse = await sfnClient.send(listCommand);
    const executions = listResponse.executions || [];

    // Fetch details for each execution
    const digests: DigestHistoryItem[] = await Promise.all(
      executions.map(async (exec) => {
        try {
          const describeCommand = new DescribeExecutionCommand({
            executionArn: exec.executionArn,
          });
          const details = await sfnClient.send(describeCommand);

          let output: any = {};
          if (details.output) {
            try {
              output = JSON.parse(details.output);
            } catch {
              // Ignore parse errors
            }
          }

          const duration =
            exec.stopDate && exec.startDate
              ? Math.round((exec.stopDate.getTime() - exec.startDate.getTime()) / 1000)
              : undefined;

          return {
            executionArn: exec.executionArn || "",
            name: exec.name || "",
            date: exec.startDate?.toISOString() || "",
            status: exec.status || "UNKNOWN",
            headline: output.headline || output.shortMessage,
            summary: output.summary || output.whatHappened,
            emailsProcessed: output.stats?.processedEmails || output.stats?.totalEmails,
            aiEmails: output.stats?.aiEmails,
            cost: output.stats?.totalCost,
            keyInsights: extractKeyInsights(output),
            actionItems: extractActionItems(output),
            duration,
          };
        } catch {
          return {
            executionArn: exec.executionArn || "",
            name: exec.name || "",
            date: exec.startDate?.toISOString() || "",
            status: exec.status || "UNKNOWN",
          };
        }
      })
    );

    return NextResponse.json({ digests });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch digest history",
        details: sanitizeError(error),
      },
      { status: 500 }
    );
  }
}

function extractKeyInsights(output: any): string[] {
  if (output.keyInsights) return output.keyInsights;
  if (output.keyThemes) return output.keyThemes;
  if (output.summaries?.[0]?.keyInsights) return output.summaries[0].keyInsights;
  return [];
}

function extractActionItems(output: any): string[] {
  if (output.actionItems) return output.actionItems;
  if (output.summaries?.[0]?.actionItems) return output.summaries[0].actionItems;
  return [];
}

function getDemoDigests(): DigestHistoryItem[] {
  const now = new Date();
  return [
    {
      executionArn: "demo-1",
      name: "weekly-digest-demo-1",
      date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: "SUCCEEDED",
      headline: "AI Agents Take Center Stage",
      summary:
        "This week saw major announcements from OpenAI and Anthropic on agent capabilities. Claude's computer use feature and GPT-4's improved function calling are reshaping how developers build AI applications.",
      emailsProcessed: 45,
      aiEmails: 32,
      cost: 0.12,
      keyInsights: [
        "Agent frameworks are becoming the new API wrappers",
        "Multi-modal understanding is table stakes now",
        "Cost optimization remains a key differentiator",
      ],
      actionItems: [
        "Evaluate agent frameworks for your product",
        "Consider multi-modal inputs for your use case",
      ],
      duration: 180,
    },
    {
      executionArn: "demo-2",
      name: "weekly-digest-demo-2",
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "SUCCEEDED",
      headline: "Open Source Models Close the Gap",
      summary:
        "Llama 3 and Mixtral continue to improve, with benchmarks showing they're now competitive with GPT-4 for many tasks. Fine-tuning is becoming more accessible.",
      emailsProcessed: 38,
      aiEmails: 28,
      cost: 0.09,
      keyInsights: [
        "Open source models are viable for production",
        "Fine-tuning costs have dropped 10x",
        "RAG remains the most practical augmentation method",
      ],
      actionItems: ["Test Llama 3 for your specific use case", "Review your fine-tuning strategy"],
      duration: 156,
    },
  ];
}
