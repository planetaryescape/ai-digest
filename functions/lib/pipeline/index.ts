export * from "./PayloadManager";
export * from "./PipelineMessage";
export { PipelineStages as PipelineStage } from "./PipelineMessage";
export * from "./QueueClient";
export * from "./StateManager";

import { PayloadManager } from "./PayloadManager";
import { QueueClient } from "./QueueClient";
import { StateManager } from "./StateManager";

/**
 * Factory functions for creating pipeline components
 */
export function createPipelineComponents() {
  const stateManager = new StateManager();
  const payloadManager = new PayloadManager();
  const queueClient = new QueueClient(payloadManager);

  return {
    stateManager,
    payloadManager,
    queueClient,
  };
}

/**
 * Base handler for Lambda functions in the pipeline
 */
export abstract class PipelineLambdaHandler<TInput = any, TOutput = any> {
  protected stateManager: StateManager;
  protected payloadManager: PayloadManager;
  protected queueClient: QueueClient;

  constructor() {
    const components = createPipelineComponents();
    this.stateManager = components.stateManager;
    this.payloadManager = components.payloadManager;
    this.queueClient = components.queueClient;
  }

  /**
   * Main handler entry point for Lambda
   */
  async handler(event: any, context: any): Promise<any> {
    // Handle SQS batch event
    if (event.Records) {
      const results = await Promise.allSettled(
        event.Records.map((record: any) => this.processSQSRecord(record))
      );

      // Check for failures
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(`Failed to process ${failures.length} messages`);
        // Return partial batch failure response
        return {
          batchItemFailures: failures.map((_, index) => ({
            itemIdentifier: event.Records[index].messageId,
          })),
        };
      }

      return { statusCode: 200 };
    }

    // Handle direct invocation
    return this.handleDirectInvocation(event, context);
  }

  /**
   * Process a single SQS record
   */
  private async processSQSRecord(record: any): Promise<void> {
    const message = JSON.parse(record.body);

    try {
      // Process the message through the pipeline stage
      const processedMessage = await this.processMessage(message);

      // Send to next stage if processing succeeded
      if (processedMessage) {
        await this.queueClient.sendToNextStage(processedMessage);
      }

      // Clean up S3 payload if it was used
      if (message.payload.type === "s3" && message.payload.s3Key) {
        await this.payloadManager.deletePayload(message.payload.s3Key);
      }
    } catch (error) {
      console.error("Failed to process message:", error);

      // Update error count in state
      await this.stateManager.incrementCost(
        message.correlationId,
        "openai", // This should be parameterized
        0
      );

      throw error; // Let Lambda retry or send to DLQ
    }
  }

  /**
   * Process a pipeline message - to be implemented by subclasses
   */
  protected abstract processMessage(message: TInput): Promise<TOutput | null>;

  /**
   * Handle direct Lambda invocation - to be implemented by subclasses
   */
  protected abstract handleDirectInvocation(event: any, context: any): Promise<any>;
}
