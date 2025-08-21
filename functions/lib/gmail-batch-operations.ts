import { gmail_v1 } from "googleapis";
import { CostTracker } from "./cost-tracker";
import { createLogger } from "./logger";
import { BATCH_LIMITS, RATE_LIMITS } from "./constants";

const log = createLogger("GmailBatchOperations");

export class GmailBatchOperations {
  constructor(
    private gmail: gmail_v1.Gmail,
    private costTracker: CostTracker
  ) {}

  async batchGetMessages(messageIds: string[]): Promise<any[]> {
    const messages: any[] = [];
    const batches = this.createBatches(messageIds, BATCH_LIMITS.GMAIL_API);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map((id) => this.getMessage(id))
      );
      messages.push(...batchResults.filter(Boolean));

      // Rate limiting between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.GMAIL_BATCH_DELAY_MS));
      }
    }

    return messages;
  }

  async batchModifyMessages(
    messageIds: string[],
    modifications: { addLabelIds?: string[]; removeLabelIds?: string[] }
  ): Promise<void> {
    const batches = this.createBatches(messageIds, BATCH_LIMITS.GMAIL_API);

    for (const batch of batches) {
      try {
        await this.gmail.users.messages.batchModify({
          userId: "me",
          requestBody: {
            ids: batch,
            addLabelIds: modifications.addLabelIds,
            removeLabelIds: modifications.removeLabelIds,
          },
        });

        this.costTracker.recordApiCall("gmail", "batchModify");
        log.info({ count: batch.length }, "Batch modification complete");
      } catch (error) {
        log.error({ error, batchSize: batch.length }, "Batch modification failed");
      }

      // Rate limiting
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.GMAIL_BATCH_DELAY_MS));
      }
    }
  }

  private async getMessage(messageId: string): Promise<any> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });

      this.costTracker.recordApiCall("gmail", "get");
      return response.data;
    } catch (error) {
      log.error({ error, messageId }, "Failed to fetch message");
      return null;
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}