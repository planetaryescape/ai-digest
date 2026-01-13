import { createLogger } from "../../logger";
import type { EmailItem } from "../../types";
import { type Result, ResultUtils } from "../../types/Result";
import type { IPipelineStage } from "../EmailPipeline";

const log = createLogger("batching-stage");

/**
 * Stage to batch emails for processing
 */
export class BatchingStage implements IPipelineStage<EmailItem[], EmailItem[][]> {
  name = "Batching";

  constructor(
    private readonly batchSize: number = 50,
    private readonly maxBatches?: number
  ) {}

  async execute(emails: EmailItem[]): Promise<Result<EmailItem[][]>> {
    try {
      const batches: EmailItem[][] = [];

      for (let i = 0; i < emails.length; i += this.batchSize) {
        if (this.maxBatches && batches.length >= this.maxBatches) {
          log.warn(`Reached max batch limit of ${this.maxBatches}`);
          break;
        }

        const batch = emails.slice(i, i + this.batchSize);
        batches.push(batch);
      }

      log.info(`Created ${batches.length} batches from ${emails.length} emails`);
      return ResultUtils.ok(batches);
    } catch (error) {
      return ResultUtils.err(error as Error);
    }
  }
}
