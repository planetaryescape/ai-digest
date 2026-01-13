import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { CircuitState } from "../circuit-breaker";
import type { ApiCosts } from "../cost-tracker";
import { createLogger } from "../logger";

const log = createLogger("pipeline-state-manager");

/**
 * Converts Maps to plain objects for DynamoDB storage
 */
function serializeData(data: any): any {
  if (data instanceof Map) {
    return Object.fromEntries(data);
  }
  if (Array.isArray(data)) {
    return data.map(serializeData);
  }
  if (data && typeof data === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeData(value);
    }
    return result;
  }
  return data;
}

/**
 * Converts plain objects back to Maps where appropriate
 */
function deserializeData(data: any, path: string[] = []): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  // Special handling for known Map fields
  const mapFields = ["classifications", "senderCache"];
  const currentPath = path[path.length - 1];

  if (mapFields.includes(currentPath) && !Array.isArray(data)) {
    return new Map(Object.entries(data));
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => deserializeData(item, [...path, String(index)]));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = deserializeData(value, [...path, key]);
  }
  return result;
}

/**
 * Manages shared state across pipeline stages using DynamoDB
 */
export class StateManager {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string = process.env.PIPELINE_STATE_TABLE || "ai-digest-pipeline-state") {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });

    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
      },
    });

    this.tableName = tableName;
  }

  /**
   * Save cost tracking state
   */
  async saveCostState(correlationId: string, costs: ApiCosts): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours TTL

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            correlationId,
            stateType: "COST",
            costs,
            updatedAt: Date.now(),
            expiresAt,
          },
        })
      );

      log.debug({ correlationId }, "Cost state saved");
    } catch (error) {
      log.error({ error, correlationId }, "Failed to save cost state");
      throw error;
    }
  }

  /**
   * Get cost tracking state
   */
  async getCostState(correlationId: string): Promise<ApiCosts | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            correlationId,
            stateType: "COST",
          },
        })
      );

      return result.Item?.costs || null;
    } catch (error) {
      log.error({ error, correlationId }, "Failed to get cost state");
      return null;
    }
  }

  /**
   * Increment cost atomically
   */
  async incrementCost(
    correlationId: string,
    service: "openai" | "firecrawl" | "brave",
    amount: number
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours TTL

    try {
      await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            correlationId,
            stateType: "COST",
          },
          UpdateExpression: `
            ADD costs.#service.cost :amount,
                costs.#service.calls :one
            SET updatedAt = :now,
                expiresAt = :expiresAt
          `,
          ExpressionAttributeNames: {
            "#service": service,
          },
          ExpressionAttributeValues: {
            ":amount": amount,
            ":one": 1,
            ":now": Date.now(),
            ":expiresAt": expiresAt,
          },
        })
      );

      log.debug({ correlationId, service, amount }, "Cost incremented");
    } catch (error) {
      log.error({ error, correlationId, service }, "Failed to increment cost");
      throw error;
    }
  }

  /**
   * Save circuit breaker state
   */
  async saveCircuitBreakerState(
    correlationId: string,
    serviceName: string,
    state: CircuitState,
    failures: number,
    lastFailTime?: Date
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours TTL

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            correlationId,
            stateType: `CIRCUIT_${serviceName.toUpperCase()}`,
            state,
            failures,
            lastFailTime: lastFailTime?.toISOString(),
            updatedAt: Date.now(),
            expiresAt,
          },
        })
      );

      log.debug({ correlationId, serviceName, state }, "Circuit breaker state saved");
    } catch (error) {
      log.error({ error, correlationId, serviceName }, "Failed to save circuit breaker state");
      throw error;
    }
  }

  /**
   * Get circuit breaker state
   */
  async getCircuitBreakerState(
    correlationId: string,
    serviceName: string
  ): Promise<{ state: CircuitState; failures: number; lastFailTime?: Date } | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            correlationId,
            stateType: `CIRCUIT_${serviceName.toUpperCase()}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return {
        state: result.Item.state,
        failures: result.Item.failures,
        lastFailTime: result.Item.lastFailTime ? new Date(result.Item.lastFailTime) : undefined,
      };
    } catch (error) {
      log.error({ error, correlationId, serviceName }, "Failed to get circuit breaker state");
      return null;
    }
  }

  /**
   * Save processed email IDs to prevent duplicates
   */
  async saveProcessedEmails(correlationId: string, emailIds: string[]): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 604800; // 7 days TTL

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            correlationId,
            stateType: "PROCESSED_EMAILS",
            emailIds,
            count: emailIds.length,
            processedAt: Date.now(),
            expiresAt,
          },
        })
      );

      log.debug({ correlationId, count: emailIds.length }, "Processed emails saved");
    } catch (error) {
      log.error({ error, correlationId }, "Failed to save processed emails");
      throw error;
    }
  }

  /**
   * Get processed email IDs
   */
  async getProcessedEmails(correlationId: string): Promise<string[]> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            correlationId,
            stateType: "PROCESSED_EMAILS",
          },
        })
      );

      return result.Item?.emailIds || [];
    } catch (error) {
      log.error({ error, correlationId }, "Failed to get processed emails");
      return [];
    }
  }

  /**
   * Save batch correlation data
   */
  async saveBatchCorrelation(
    batchId: string,
    correlationIds: string[],
    metadata: any
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 hours TTL

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            correlationId: `BATCH_${batchId}`,
            stateType: "BATCH_METADATA",
            batchId,
            correlationIds,
            metadata,
            createdAt: Date.now(),
            expiresAt,
          },
        })
      );

      log.debug({ batchId, correlationCount: correlationIds.length }, "Batch correlation saved");
    } catch (error) {
      log.error({ error, batchId }, "Failed to save batch correlation");
      throw error;
    }
  }

  /**
   * Get all states for a batch
   */
  async getBatchStates(batchId: string): Promise<any[]> {
    try {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "BatchIndex",
          KeyConditionExpression: "batchId = :batchId",
          ExpressionAttributeValues: {
            ":batchId": batchId,
          },
        })
      );

      return result.Items || [];
    } catch (error) {
      log.error({ error, batchId }, "Failed to get batch states");
      return [];
    }
  }

  /**
   * Save checkpoint for recovery
   */
  async saveCheckpoint(correlationId: string, stage: string, data: any): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + 172800; // 48 hours TTL

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            correlationId,
            stateType: `CHECKPOINT_${stage.toUpperCase()}`,
            stage,
            data: serializeData(data), // Serialize Maps to objects
            createdAt: Date.now(),
            expiresAt,
          },
        })
      );

      log.debug({ correlationId, stage }, "Checkpoint saved");
    } catch (error) {
      log.error({ error, correlationId, stage }, "Failed to save checkpoint");
      throw error;
    }
  }

  /**
   * Get checkpoint for recovery
   */
  async getCheckpoint(correlationId: string, stage: string): Promise<any | null> {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            correlationId,
            stateType: `CHECKPOINT_${stage.toUpperCase()}`,
          },
        })
      );

      return result.Item?.data ? deserializeData(result.Item.data) : null;
    } catch (error) {
      log.error({ error, correlationId, stage }, "Failed to get checkpoint");
      return null;
    }
  }

  /**
   * Clean up all state for a correlation ID
   */
  async cleanupCorrelation(correlationId: string): Promise<void> {
    try {
      // Query all items for this correlation ID
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "correlationId = :correlationId",
          ExpressionAttributeValues: {
            ":correlationId": correlationId,
          },
        })
      );

      // Delete all items
      if (result.Items && result.Items.length > 0) {
        for (const item of result.Items) {
          await this.docClient.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: {
                correlationId: item.correlationId,
                stateType: item.stateType,
              },
            })
          );
        }

        log.info({ correlationId, count: result.Items.length }, "Correlation state cleaned up");
      }
    } catch (error) {
      log.error({ error, correlationId }, "Failed to cleanup correlation");
      throw error;
    }
  }
}
