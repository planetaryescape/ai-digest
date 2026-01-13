import type { CompositeAIDetectionStrategy } from "../../gmail/ai-detection-strategies";
import { createLogger } from "../../logger";
import type { EmailItem } from "../../types";
import { type Result, ResultUtils } from "../../types/Result";
import type { IPipelineStage } from "../EmailPipeline";

const log = createLogger("filter-ai-stage");

/**
 * Stage to filter emails to only AI-related ones
 */
export class FilterAIEmailsStage implements IPipelineStage {
  name = "FilterAIEmails";

  constructor(
    private readonly aiDetectionStrategy: CompositeAIDetectionStrategy,
    private readonly senderTracker?: any
  ) {}

  async execute(emails: EmailItem[]): Promise<Result<EmailItem[]>> {
    try {
      const filtered: EmailItem[] = [];

      for (const email of emails) {
        const isAI = await this.aiDetectionStrategy.detect(
          email.subject,
          email.sender,
          this.senderTracker
        );

        if (isAI) {
          filtered.push(email);
          log.debug(`AI email detected: ${email.subject?.substring(0, 50)}`);
        }
      }

      log.info(`Filtered ${emails.length} emails to ${filtered.length} AI-related emails`);
      return ResultUtils.ok(filtered);
    } catch (error) {
      return ResultUtils.err(error as Error);
    }
  }

  shouldStop(result: Result<EmailItem[]>): boolean {
    // Stop pipeline if no AI emails found
    return result.ok && result.value.length === 0;
  }
}
