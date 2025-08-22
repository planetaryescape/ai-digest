import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { Context } from "aws-lambda";
import { createLogger } from "../../lib/logger";

const log = createLogger("cleanup-batch");
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "us-east-1" });

const _PIPELINE_FUNCTION =
  process.env.PIPELINE_FUNCTION ||
  "arn:aws:states:us-east-1:536697242054:stateMachine:ai-digest-pipeline";
const BATCH_SIZE = Number.parseInt(process.env.BATCH_SIZE || "50", 10);

interface CleanupBatchInput {
  batchSize?: number;
}

export const handler = async (
  event: CleanupBatchInput,
  _context: Context
): Promise<{
  success: boolean;
  message: string;
  batches: number;
}> => {
  const batchSize = event.batchSize || BATCH_SIZE;
  log.info({ batchSize }, "Starting cleanup batch processing");

  try {
    // First, fetch all emails to determine batch count
    const { EmailFetcherAgent } = await import("../../lib/agents/EmailFetcherAgent");
    const { CostTracker } = await import("../../lib/cost-tracker");

    const costTracker = new CostTracker();
    const fetcher = new EmailFetcherAgent(costTracker);
    const allEmails = await fetcher.fetchEmails({ mode: "cleanup" });

    const totalEmails = allEmails.fullEmails.length;
    const totalBatches = Math.ceil(totalEmails / batchSize);

    log.info(
      {
        totalEmails,
        totalBatches,
        batchSize,
      },
      "Calculated batch requirements"
    );

    if (totalEmails === 0) {
      return {
        success: true,
        message: "No emails found to process",
        batches: 0,
      };
    }

    // Process emails in batches by invoking the pipeline directly with pre-batched data
    for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
      const startIdx = batchNumber * batchSize;
      const endIdx = Math.min(startIdx + batchSize, totalEmails);

      log.info(
        {
          batchNumber: batchNumber + 1,
          totalBatches,
          startIdx,
          endIdx,
        },
        "Processing batch"
      );

      // Create batch payload
      const batchPayload = {
        mode: "batch",
        batchNumber: batchNumber + 1,
        totalBatches,
        emails: allEmails.fullEmails.slice(startIdx, endIdx),
        metadata: allEmails.metadata.slice(startIdx, endIdx),
        aiEmailIds: allEmails.aiEmailIds.filter((id: string) => {
          const emailIdx = allEmails.fullEmails.findIndex((e: any) => e.id === id);
          return emailIdx >= startIdx && emailIdx < endIdx;
        }),
        stats: {
          batch: batchNumber + 1,
          total: totalBatches,
          emailsInBatch: endIdx - startIdx,
        },
      };

      // Invoke the digest processor directly for this batch
      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: "ai-digest-weekly-digest",
          InvocationType: "Event", // Async invocation
          Payload: JSON.stringify(batchPayload),
        })
      );

      log.info(
        {
          batchNumber: batchNumber + 1,
        },
        "Batch invocation sent"
      );

      // Small delay between batches to avoid overwhelming the system
      if (batchNumber < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      message: `Started processing ${totalBatches} batches of ${batchSize} emails each`,
      batches: totalBatches,
    };
  } catch (error) {
    log.error({ error }, "Cleanup batch processing failed");
    throw error;
  }
};
