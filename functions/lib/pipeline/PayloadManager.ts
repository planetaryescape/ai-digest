import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createLogger } from "../logger";
import type { PayloadReference, PipelineMessage } from "./PipelineMessage";

const log = createLogger("payload-manager");

/**
 * Manages large payloads that exceed SQS message size limits
 * Automatically offloads to S3 and retrieves as needed
 */
export class PayloadManager {
  private s3Client: S3Client;
  private bucketName: string;
  private maxInlineSize: number;

  constructor(
    bucketName: string = process.env.PIPELINE_DATA_BUCKET || "ai-digest-pipeline-data",
    maxInlineSize: number = 200 * 1024 // 200KB to leave room for metadata
  ) {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.bucketName = bucketName;
    this.maxInlineSize = maxInlineSize;
  }

  /**
   * Store payload - automatically decides between inline or S3
   */
  async storePayload<T>(
    data: T,
    correlationId: string,
    stage: string
  ): Promise<PayloadReference<T>> {
    const serialized = JSON.stringify(data);
    const sizeBytes = Buffer.byteLength(serialized);

    // If small enough, return inline reference
    if (sizeBytes <= this.maxInlineSize) {
      log.debug({ correlationId, stage, sizeBytes }, "Payload small enough for inline storage");

      return {
        type: "inline",
        data,
        sizeBytes,
      };
    }

    // Otherwise, store in S3
    const s3Key = this.generateS3Key(correlationId, stage);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: serialized,
          ContentType: "application/json",
          Metadata: {
            correlationId,
            stage,
            timestamp: Date.now().toString(),
          },
        })
      );

      log.info({ correlationId, stage, s3Key, sizeBytes }, "Payload stored in S3");

      return {
        type: "s3",
        s3Key,
        sizeBytes,
      };
    } catch (error) {
      log.error({ error, correlationId, stage, sizeBytes }, "Failed to store payload in S3");
      throw error;
    }
  }

  /**
   * Retrieve payload from reference
   */
  async retrievePayload<T>(reference: PayloadReference<T>, correlationId: string): Promise<T> {
    // If inline, return directly
    if (reference.type === "inline") {
      if (!reference.data) {
        throw new Error("Inline payload reference missing data");
      }
      return reference.data;
    }

    // Otherwise, fetch from S3
    if (!reference.s3Key) {
      throw new Error("S3 payload reference missing key");
    }

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: reference.s3Key,
        })
      );

      if (!response.Body) {
        throw new Error("S3 object has no body");
      }

      const bodyString = await response.Body.transformToString();
      const data = JSON.parse(bodyString);

      log.debug(
        { correlationId, s3Key: reference.s3Key, sizeBytes: reference.sizeBytes },
        "Payload retrieved from S3"
      );

      return data;
    } catch (error) {
      log.error(
        { error, correlationId, s3Key: reference.s3Key },
        "Failed to retrieve payload from S3"
      );
      throw error;
    }
  }

  /**
   * Clean up S3 payload
   */
  async deletePayload(s3Key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        })
      );

      log.debug({ s3Key }, "Payload deleted from S3");
    } catch (error) {
      log.error({ error, s3Key }, "Failed to delete payload from S3");
      // Don't throw - cleanup failures shouldn't break the pipeline
    }
  }

  /**
   * Clean up all payloads for a correlation
   */
  async cleanupCorrelation(correlationId: string): Promise<void> {
    // In a production system, you'd list and delete all objects with this correlation ID
    // For now, we'll rely on S3 lifecycle policies for cleanup
    log.debug({ correlationId }, "Correlation cleanup requested (using lifecycle policy)");
  }

  /**
   * Generate S3 key for payload storage
   */
  private generateS3Key(correlationId: string, stage: string): string {
    const timestamp = Date.now();
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Organize by date for easier management
    return `payloads/${date}/${correlationId}/${stage}-${timestamp}.json`;
  }

  /**
   * Prepare message for SQS - handle payload offloading if needed
   */
  async prepareMessageForSQS<T>(message: PipelineMessage<T>): Promise<PipelineMessage<T>> {
    // Check if message needs offloading
    const messageSize = JSON.stringify(message).length;

    if (messageSize <= this.maxInlineSize) {
      return message; // Small enough to send as-is
    }

    // Offload payload to S3
    if (message.payload.type === "inline" && message.payload.data) {
      const s3Reference = await this.storePayload(
        message.payload.data,
        message.correlationId,
        message.stage
      );

      // Return message with S3 reference instead of inline data
      return {
        ...message,
        payload: s3Reference,
      };
    }

    return message;
  }

  /**
   * Process message from SQS - retrieve payload if needed
   */
  async processMessageFromSQS<T>(message: PipelineMessage<T>): Promise<PipelineMessage<T>> {
    // If payload is already inline, return as-is
    if (message.payload.type === "inline") {
      return message;
    }

    // Retrieve from S3 and convert to inline
    const data = await this.retrievePayload(message.payload, message.correlationId);

    return {
      ...message,
      payload: {
        type: "inline",
        data,
        sizeBytes: message.payload.sizeBytes,
      },
    };
  }
}

/**
 * Singleton instance for convenience
 */
let defaultManager: PayloadManager | null = null;

export function getPayloadManager(): PayloadManager {
  if (!defaultManager) {
    defaultManager = new PayloadManager();
  }
  return defaultManager;
}
