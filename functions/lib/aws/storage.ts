import {
  BatchWriteItemCommand,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { format, subDays } from "date-fns";
import type { IStorageClient } from "../interfaces/storage";
import type { ProcessedEmail } from "../types";

/**
 * AWS DynamoDB implementation of IStorageClient
 */
export class DynamoDBStorageClient implements IStorageClient {
  private client: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.tableName = process.env.DYNAMODB_TABLE_NAME || "ai-digest-processed-emails";
  }

  async markProcessed(emailId: string, subject: string): Promise<void> {
    const now = new Date();
    const ttl = Math.floor(subDays(now, -90).getTime() / 1000); // 90 days TTL

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: {
        partitionKey: { S: "processed" },
        rowKey: { S: emailId },
        subject: { S: subject },
        processedAt: { S: now.toISOString() },
        timestamp: { N: now.getTime().toString() },
        ttl: { N: ttl.toString() },
      },
    });

    try {
      await this.client.send(command);
      console.log(`Marked email as processed: ${emailId}`);
    } catch (error) {
      console.error(`Failed to mark email as processed: ${emailId}`, error);
      throw error;
    }
  }

  async markMultipleProcessed(emails: Array<{ id: string; subject: string }>): Promise<void> {
    // Process in batches of 25 (DynamoDB batch write limit)
    const batchSize = 25;
    const now = new Date();
    const ttl = Math.floor(subDays(now, -90).getTime() / 1000);

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const command = new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: batch.map((email) => ({
            PutRequest: {
              Item: {
                partitionKey: { S: "processed" },
                rowKey: { S: email.id },
                subject: { S: email.subject },
                processedAt: { S: now.toISOString() },
                timestamp: { N: now.getTime().toString() },
                ttl: { N: ttl.toString() },
              },
            },
          })),
        },
      });

      try {
        await this.client.send(command);
        console.log(`Marked ${batch.length} emails as processed`);
      } catch (error) {
        console.error("Failed to mark emails as processed", error);
        throw error;
      }
    }
  }

  async getWeeklyProcessedIds(): Promise<string[]> {
    const oneWeekAgo = subDays(new Date(), 7);
    const timestamp = oneWeekAgo.getTime();

    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "partitionKey = :pk",
      FilterExpression: "#ts >= :timestamp",
      ExpressionAttributeNames: {
        "#ts": "timestamp",
      },
      ExpressionAttributeValues: {
        ":pk": { S: "processed" },
        ":timestamp": { N: timestamp.toString() },
      },
      ProjectionExpression: "rowKey",
    });

    try {
      const response = await this.client.send(command);
      const ids = response.Items?.map((item) => item.rowKey.S!) || [];
      console.log(`Found ${ids.length} processed emails from the last week`);
      return ids;
    } catch (error) {
      console.error("Failed to get weekly processed IDs", error);
      return [];
    }
  }

  async getAllProcessed(): Promise<ProcessedEmail[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: "partitionKey = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: "processed" },
      },
    });

    try {
      const response = await this.client.send(command);
      const processed: ProcessedEmail[] =
        response.Items?.map((item) => ({
          emailId: item.rowKey.S!,
          subject: item.subject.S!,
          processedAt: item.processedAt.S!,
        })) || [];

      console.log(`Retrieved ${processed.length} processed emails`);
      return processed;
    } catch (error) {
      console.error("Failed to get all processed emails", error);
      return [];
    }
  }

  async getAllProcessedIds(): Promise<string[]> {
    const command = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: "partitionKey = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: "processed" },
      },
      ProjectionExpression: "rowKey",
    });

    try {
      const response = await this.client.send(command);
      const ids = response.Items?.map((item) => item.rowKey.S!) || [];
      console.log(`Found ${ids.length} total processed email IDs`);
      return ids;
    } catch (error) {
      console.error("Failed to get all processed IDs", error);
      return [];
    }
  }

  async isProcessed(emailId: string): Promise<boolean> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: {
        partitionKey: { S: "processed" },
        rowKey: { S: emailId },
      },
    });

    try {
      const response = await this.client.send(command);
      return !!response.Item;
    } catch {
      return false;
    }
  }

  async cleanupOldRecords(daysToKeep: number): Promise<number> {
    const cutoffDate = subDays(new Date(), daysToKeep);
    const timestamp = cutoffDate.getTime();

    // First, find old records
    const scanCommand = new ScanCommand({
      TableName: this.tableName,
      FilterExpression: "partitionKey = :pk AND #ts < :timestamp",
      ExpressionAttributeNames: {
        "#ts": "timestamp",
      },
      ExpressionAttributeValues: {
        ":pk": { S: "processed" },
        ":timestamp": { N: timestamp.toString() },
      },
      ProjectionExpression: "rowKey",
    });

    try {
      const response = await this.client.send(scanCommand);
      const itemsToDelete = response.Items || [];

      // Delete in batches
      const batchSize = 25;
      let deletedCount = 0;

      for (let i = 0; i < itemsToDelete.length; i += batchSize) {
        const batch = itemsToDelete.slice(i, i + batchSize);

        const deleteCommand = new BatchWriteItemCommand({
          RequestItems: {
            [this.tableName]: batch.map((item) => ({
              DeleteRequest: {
                Key: {
                  partitionKey: { S: "processed" },
                  rowKey: item.rowKey,
                },
              },
            })),
          },
        });

        await this.client.send(deleteCommand);
        deletedCount += batch.length;
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old processed records`);
      }
      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup old records", error);
      return 0;
    }
  }
}
