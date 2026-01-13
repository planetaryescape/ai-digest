import { v4 as uuidv4 } from "uuid";

/**
 * Standard message format for pipeline communication via SQS
 */
export interface PipelineMessage<T = any> {
  correlationId: string;
  batchId: string;
  stage: PipelineStage;
  timestamp: number;
  payload: PayloadReference<T>;
  metadata: PipelineMetadata;
  error?: PipelineError;
}

export type PipelineStage =
  | "fetch"
  | "classify"
  | "extract"
  | "research"
  | "analyze"
  | "critique"
  | "send";

export const PipelineStages = {
  FETCH: "fetch" as PipelineStage,
  CLASSIFY: "classify" as PipelineStage,
  EXTRACT: "extract" as PipelineStage,
  RESEARCH: "research" as PipelineStage,
  ANALYZE: "analyze" as PipelineStage,
  CRITIQUE: "critique" as PipelineStage,
  SEND: "send" as PipelineStage,
};

export interface PayloadReference<T = any> {
  type: "inline" | "s3";
  data?: T;
  s3Key?: string;
  sizeBytes?: number;
}

export interface PipelineMetadata {
  emailCount: number;
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  costSoFar: number;
  startTime: number;
  currentStageStartTime: number;
  previousStages: StageHistory[];
}

export interface StageHistory {
  stage: PipelineStage;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface PipelineError {
  code: string;
  message: string;
  stage: PipelineStage;
  timestamp: number;
  retryable: boolean;
  details?: any;
}

/**
 * Builder for creating pipeline messages
 */
export class PipelineMessageBuilder<T = any> {
  private message: Partial<PipelineMessage<T>>;

  constructor(stage: PipelineStage) {
    this.message = {
      correlationId: uuidv4(),
      batchId: uuidv4(),
      stage,
      timestamp: Date.now(),
      metadata: {
        emailCount: 0,
        processedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        costSoFar: 0,
        startTime: Date.now(),
        currentStageStartTime: Date.now(),
        previousStages: [],
      },
    };
  }

  static fromPrevious<T>(
    previousMessage: PipelineMessage,
    nextStage: PipelineStage
  ): PipelineMessageBuilder<T> {
    const builder = new PipelineMessageBuilder<T>(nextStage);

    // Preserve correlation and batch IDs
    builder.message.correlationId = previousMessage.correlationId;
    builder.message.batchId = previousMessage.batchId;

    // Update metadata with previous stage history
    const previousStageHistory: StageHistory = {
      stage: previousMessage.stage,
      startTime: previousMessage.metadata.currentStageStartTime,
      endTime: Date.now(),
      durationMs: Date.now() - previousMessage.metadata.currentStageStartTime,
      success: !previousMessage.error,
      error: previousMessage.error?.message,
    };

    builder.message.metadata = {
      ...previousMessage.metadata,
      currentStageStartTime: Date.now(),
      previousStages: [...previousMessage.metadata.previousStages, previousStageHistory],
    };

    return builder;
  }

  withCorrelationId(id: string): this {
    this.message.correlationId = id;
    return this;
  }

  withBatchId(id: string): this {
    this.message.batchId = id;
    return this;
  }

  withInlinePayload(data: T): this {
    this.message.payload = {
      type: "inline",
      data,
      sizeBytes: JSON.stringify(data).length,
    };
    return this;
  }

  withS3Payload(s3Key: string, sizeBytes?: number): this {
    this.message.payload = {
      type: "s3",
      s3Key,
      sizeBytes,
    };
    return this;
  }

  withMetadata(metadata: Partial<PipelineMetadata>): this {
    this.message.metadata = {
      ...this.message.metadata!,
      ...metadata,
    };
    return this;
  }

  incrementProcessed(count: number = 1): this {
    this.message.metadata!.processedCount += count;
    return this;
  }

  incrementSkipped(count: number = 1): this {
    this.message.metadata!.skippedCount += count;
    return this;
  }

  incrementError(count: number = 1): this {
    this.message.metadata!.errorCount += count;
    return this;
  }

  addCost(cost: number): this {
    this.message.metadata!.costSoFar += cost;
    return this;
  }

  withError(error: PipelineError): this {
    this.message.error = error;
    return this;
  }

  build(): PipelineMessage<T> {
    if (!this.message.payload) {
      throw new Error("Payload is required");
    }

    return this.message as PipelineMessage<T>;
  }
}

/**
 * Utility to calculate message size
 */
export function getMessageSize(message: PipelineMessage): number {
  return JSON.stringify(message).length;
}

/**
 * Check if message size exceeds SQS limit (256KB)
 */
export function exceedsSQSLimit(message: PipelineMessage): boolean {
  const MaxSqsSize = 256 * 1024; // 256KB
  return getMessageSize(message) > MaxSqsSize;
}

/**
 * Extract stage duration from message metadata
 */
export function getStageDuration(message: PipelineMessage, stage: PipelineStage): number | null {
  const stageHistory = message.metadata.previousStages.find((s) => s.stage === stage);
  return stageHistory?.durationMs || null;
}

/**
 * Get total pipeline duration so far
 */
export function getTotalDuration(message: PipelineMessage): number {
  return Date.now() - message.metadata.startTime;
}

/**
 * Check if pipeline is approaching timeout
 */
export function isApproachingTimeout(
  message: PipelineMessage,
  maxDurationMs: number = 900000
): boolean {
  // Default 15 minutes max duration
  return getTotalDuration(message) > maxDurationMs * 0.8; // Alert at 80%
}
