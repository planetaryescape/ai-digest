import { createLogger } from "../logger";
import type { EmailItem } from "../types";
import { type Result, ResultUtils } from "../types/Result";

const log = createLogger("email-pipeline");

/**
 * Base interface for pipeline stages
 */
export interface IPipelineStage<TIn = EmailItem[], TOut = EmailItem[]> {
  name: string;
  execute(input: TIn): Promise<Result<TOut>>;
  shouldStop?(result: Result<TOut>): boolean;
}

/**
 * Pipeline statistics
 */
export interface PipelineStats {
  totalEmails: number;
  processedEmails: number;
  filteredEmails: number;
  errors: number;
  duration: number;
  stageStats: Map<string, StageStats>;
}

interface StageStats {
  duration: number;
  itemsIn: number;
  itemsOut: number;
  errors: number;
}

/**
 * Result of pipeline processing
 */
export interface PipelineResult {
  emails: EmailItem[];
  stats: PipelineStats;
}

/**
 * Email processing pipeline
 * Allows composing multiple processing stages
 */
export class EmailPipeline {
  private stages: IPipelineStage[] = [];
  private stats: PipelineStats = {
    totalEmails: 0,
    processedEmails: 0,
    filteredEmails: 0,
    errors: 0,
    duration: 0,
    stageStats: new Map(),
  };

  /**
   * Add a processing stage to the pipeline
   */
  addStage(stage: IPipelineStage): this {
    this.stages.push(stage);
    return this;
  }

  /**
   * Process emails through all stages
   */
  async process(emails: EmailItem[]): Promise<Result<PipelineResult>> {
    const startTime = Date.now();
    this.stats.totalEmails = emails.length;

    let currentResult: Result<EmailItem[]> = ResultUtils.ok(emails);

    for (const stage of this.stages) {
      if (!currentResult.ok) {
        break;
      }

      const stageStartTime = Date.now();
      const itemsIn = currentResult.value.length;

      log.info(`Executing stage: ${stage.name} with ${itemsIn} items`);

      const stageResult = await stage.execute(currentResult.value);

      // Track stage statistics
      const stageDuration = Date.now() - stageStartTime;
      const itemsOut = stageResult.ok ? stageResult.value.length : 0;

      this.stats.stageStats.set(stage.name, {
        duration: stageDuration,
        itemsIn,
        itemsOut,
        errors: stageResult.ok ? 0 : 1,
      });

      if (!stageResult.ok) {
        log.error({ error: stageResult.error }, `Stage ${stage.name} failed`);
        this.stats.errors++;
        return {
          ok: false,
          error: stageResult.error,
        };
      }

      currentResult = stageResult;

      // Check if stage wants to stop the pipeline
      if (stage.shouldStop && stage.shouldStop(stageResult)) {
        log.info(`Stage ${stage.name} requested pipeline stop`);
        break;
      }
    }

    this.stats.duration = Date.now() - startTime;
    this.stats.processedEmails = currentResult.ok ? currentResult.value.length : 0;
    this.stats.filteredEmails = this.stats.totalEmails - this.stats.processedEmails;

    if (!currentResult.ok) {
      return {
        ok: false,
        error: currentResult.error,
      };
    }

    return ResultUtils.ok({
      emails: currentResult.value,
      stats: this.stats,
    });
  }

  /**
   * Get pipeline statistics
   */
  getStats(): PipelineStats {
    return { ...this.stats };
  }

  /**
   * Clear all stages
   */
  clear(): void {
    this.stages = [];
    this.stats.stageStats.clear();
  }
}
