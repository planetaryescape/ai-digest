import { createLogger } from "../../logger";
import type { IEmailRepository } from "../../repositories/EmailRepository";
import type { EmailItem } from "../../types";
import { type Result, ResultUtils } from "../../types/Result";
import type { IPipelineStage } from "../EmailPipeline";

const log = createLogger("deduplication-stage");

/**
 * Stage to remove already processed emails
 */
export class DeduplicationStage implements IPipelineStage {
  name = "Deduplication";

  constructor(private readonly emailRepository: IEmailRepository) {}

  async execute(emails: EmailItem[]): Promise<Result<EmailItem[]>> {
    try {
      const unprocessed = await this.emailRepository.findUnprocessed(emails);

      log.info(`Deduplicated ${emails.length} emails to ${unprocessed.length} unprocessed emails`);

      return ResultUtils.ok(unprocessed);
    } catch (error) {
      return ResultUtils.err(error as Error);
    }
  }

  shouldStop(result: Result<EmailItem[]>): boolean {
    // Stop if all emails were already processed
    return result.ok && result.value.length === 0;
  }
}
