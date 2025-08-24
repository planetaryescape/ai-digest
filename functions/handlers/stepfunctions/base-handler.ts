import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Context } from "aws-lambda";
import { SecretsLoader } from "../../lib/aws/secrets-loader";
import { CostTracker } from "../../lib/cost-tracker";
import { createLogger } from "../../lib/logger";

const log = createLogger("sf-base-handler");

/**
 * Base handler for Step Functions Lambda functions
 * Provides common functionality for S3 storage and cost tracking
 */
export abstract class BaseStepFunctionHandler {
  protected s3Client: S3Client;
  protected costTracker: CostTracker;
  protected bucketName: string;
  private static secretsLoaded = false;

  constructor() {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
    this.costTracker = new CostTracker();
    this.bucketName = process.env.PIPELINE_DATA_BUCKET || "ai-digest-pipeline-data";
  }

  /**
   * Main handler method for Lambda
   */
  async handler(event: any, context: Context): Promise<any> {
    // Load secrets on cold start
    if (!BaseStepFunctionHandler.secretsLoaded) {
      try {
        await SecretsLoader.loadSecrets();
        BaseStepFunctionHandler.secretsLoaded = true;
        log.info("Secrets loaded successfully");
      } catch (error) {
        log.error({ error }, "Failed to load secrets from AWS Secrets Manager");
        // Continue anyway - some handlers may not need secrets
      }
    }

    const startTime = performance.now();
    log.info({ event, context }, "Handler invoked");

    try {
      const result = await this.process(event, context);

      const executionTime = performance.now() - startTime;
      log.info({ executionTime, cost: this.costTracker.getTotalCost() }, "Handler completed");

      return result;
    } catch (error) {
      log.error({ error }, "Handler failed");
      throw error;
    }
  }

  /**
   * Abstract method to be implemented by specific handlers
   */
  abstract process(event: any, context: Context): Promise<any>;

  /**
   * Store large objects in S3
   */
  protected async storeInS3(
    data: any,
    key: string
  ): Promise<{ type: "s3"; bucket: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: "application/json",
    });

    await this.s3Client.send(command);
    log.info({ bucket: this.bucketName, key }, "Stored data in S3");

    return {
      type: "s3",
      bucket: this.bucketName,
      key,
    };
  }

  /**
   * Retrieve objects from S3
   */
  protected async retrieveFromS3(reference: {
    type: "s3";
    bucket: string;
    key: string;
  }): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: reference.bucket,
      Key: reference.key,
    });

    const response = await this.s3Client.send(command);
    const body = await response.Body?.transformToString();

    if (!body) {
      throw new Error(`Failed to retrieve S3 object: ${reference.key}`);
    }

    return JSON.parse(body);
  }

  /**
   * Check if data should be stored in S3 (if too large)
   */
  protected shouldUseS3(data: any): boolean {
    const sizeInBytes = JSON.stringify(data).length;
    const sizeInKB = sizeInBytes / 1024;

    // Use S3 if data is larger than 256KB (Lambda payload limit is 256KB for synchronous)
    return sizeInKB > 256;
  }
}
