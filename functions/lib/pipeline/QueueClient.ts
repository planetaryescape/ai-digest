// TODO: Add @aws-sdk/client-sqs dependency to package.json if SQS queues are needed
// import {
//   SQSClient,
//   SendMessageCommand,
//   ReceiveMessageCommand,
//   DeleteMessageCommand,
//   GetQueueAttributesCommand,
//   type Message,
// } from "@aws-sdk/client-sqs";
import { createLogger } from "../logger";
import type { PayloadManager } from "./PayloadManager";
import type { PipelineMessage, PipelineStage } from "./PipelineMessage";
import { PipelineStages } from "./PipelineMessage";

const log = createLogger("queue-client");

/**
 * Maps pipeline stages to SQS queue URLs
 */
export class QueueMapper {
  private queueUrls: Map<PipelineStage, string>;

  constructor() {
    const projectName = process.env.PROJECT_NAME || "ai-digest";
    const region = process.env.AWS_REGION || "us-east-1";
    const accountId = process.env.AWS_ACCOUNT_ID || "";

    // Build queue URLs based on naming convention
    const baseUrl = `https://sqs.${region}.amazonaws.com/${accountId}`;

    this.queueUrls = new Map([
      [
        PipelineStages.CLASSIFY,
        process.env.SQS_EMAILS_TO_CLASSIFY || `${baseUrl}/${projectName}-emails-to-classify`,
      ],
      [
        PipelineStages.EXTRACT,
        process.env.SQS_EMAILS_TO_EXTRACT || `${baseUrl}/${projectName}-emails-to-extract`,
      ],
      [
        PipelineStages.RESEARCH,
        process.env.SQS_EMAILS_TO_RESEARCH || `${baseUrl}/${projectName}-emails-to-research`,
      ],
      [
        PipelineStages.ANALYZE,
        process.env.SQS_EMAILS_TO_ANALYZE || `${baseUrl}/${projectName}-emails-to-analyze`,
      ],
      [
        PipelineStages.CRITIQUE,
        process.env.SQS_ANALYSIS_TO_CRITIQUE || `${baseUrl}/${projectName}-analysis-to-critique`,
      ],
      [
        PipelineStages.SEND,
        process.env.SQS_DIGEST_TO_SEND || `${baseUrl}/${projectName}-digest-to-send`,
      ],
    ]);
  }

  getQueueUrl(stage: PipelineStage): string {
    const url = this.queueUrls.get(stage);
    if (!url) {
      throw new Error(`No queue URL configured for stage: ${stage}`);
    }
    return url;
  }

  getNextStage(currentStage: PipelineStage): PipelineStage | null {
    const stageOrder: PipelineStage[] = [
      PipelineStages.FETCH,
      PipelineStages.CLASSIFY,
      PipelineStages.EXTRACT,
      PipelineStages.RESEARCH,
      PipelineStages.ANALYZE,
      PipelineStages.CRITIQUE,
      PipelineStages.SEND,
    ];

    const currentIndex = stageOrder.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex === stageOrder.length - 1) {
      return null;
    }

    return stageOrder[currentIndex + 1];
  }
}

/**
 * Client for interacting with SQS queues in the pipeline
 * TODO: Implement when @aws-sdk/client-sqs dependency is added
 */
export class QueueClient {
  // TODO: Implement when @aws-sdk/client-sqs is available
  constructor(_payloadManager?: PayloadManager) {
    throw new Error("QueueClient requires @aws-sdk/client-sqs dependency");
  }

  // TODO: Implement when @aws-sdk/client-sqs is available
  async sendToNextStage<T>(
    _message: PipelineMessage<T>,
    _nextStage?: PipelineStage
  ): Promise<void> {
    throw new Error("QueueClient requires @aws-sdk/client-sqs dependency");
  }

  // TODO: Implement when @aws-sdk/client-sqs is available
  async receiveMessages<T>(
    _stage: PipelineStage,
    _maxMessages: number = 1,
    _waitTimeSeconds: number = 20
  ): Promise<Array<{ message: PipelineMessage<T>; receiptHandle: string }>> {
    throw new Error("QueueClient requires @aws-sdk/client-sqs dependency");
  }

  // TODO: Implement when @aws-sdk/client-sqs is available
  async deleteMessage(_stage: PipelineStage, _receiptHandle: string): Promise<void> {
    throw new Error("QueueClient requires @aws-sdk/client-sqs dependency");
  }

  // TODO: Implement when @aws-sdk/client-sqs is available
  async getQueueMetrics(_stage: PipelineStage): Promise<{
    approximateMessages: number;
    approximateMessagesNotVisible: number;
    approximateMessagesDelayed: number;
  }> {
    throw new Error("QueueClient requires @aws-sdk/client-sqs dependency");
  }

  // TODO: Implement when @aws-sdk/client-sqs is available
  async sendToDeadLetterQueue<T>(
    _message: PipelineMessage<T>,
    _error: Error,
    _stage: PipelineStage
  ): Promise<void> {
    throw new Error("QueueClient requires @aws-sdk/client-sqs dependency");
  }
}
