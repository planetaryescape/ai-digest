import {
  BatchWriteItemCommand,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type { ISenderTracker, KnownSender } from "../interfaces/sender-tracker";

export class DynamoDBSenderTracker implements ISenderTracker {
  private client: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.tableName = process.env.DYNAMODB_TABLE || "ai-digest-known-ai-senders";
  }

  async isKnownAISender(email: string): Promise<boolean> {
    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({ senderEmail: email.toLowerCase() }),
        })
      );

      if (response.Item) {
        const sender = unmarshall(response.Item) as KnownSender;
        // Consider it known if confidence is above 70%
        return sender.confidence >= 70;
      }

      return false;
    } catch (error) {
      console.error("Error checking known sender:", error);
      return false;
    }
  }

  async getAllKnownSenders(): Promise<KnownSender[]> {
    try {
      const response = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
        })
      );

      if (!response.Items) {
        return [];
      }

      return response.Items.map((item) => unmarshall(item) as KnownSender);
    } catch (error) {
      console.error("Error getting all known senders:", error);
      return [];
    }
  }

  async getKnownSendersByDomain(domain: string): Promise<KnownSender[]> {
    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "DomainIndex",
          KeyConditionExpression: "#domain = :domain",
          ExpressionAttributeNames: {
            "#domain": "domain",
          },
          ExpressionAttributeValues: marshall({
            ":domain": domain.toLowerCase(),
          }),
        })
      );

      if (!response.Items) {
        return [];
      }

      return response.Items.map((item) => unmarshall(item) as KnownSender);
    } catch (error) {
      console.error("Error getting senders by domain:", error);
      return [];
    }
  }

  async addConfirmedSender(sender: {
    email: string;
    name?: string;
    newsletterName?: string;
  }): Promise<void> {
    const email = sender.email.toLowerCase();
    const domain = email.split("@")[1] || "";
    const now = new Date().toISOString();

    try {
      // Check if sender already exists
      const existing = await this.client.send(
        new GetItemCommand({
          TableName: this.tableName,
          Key: marshall({ senderEmail: email }),
        })
      );

      if (existing.Item) {
        // Update existing sender
        const existingSender = unmarshall(existing.Item) as KnownSender;
        await this.client.send(
          new UpdateItemCommand({
            TableName: this.tableName,
            Key: marshall({ senderEmail: email }),
            UpdateExpression:
              "SET #lastSeen = :lastSeen, #emailCount = :emailCount, " +
              "#confidence = :confidence" +
              (sender.name ? ", #senderName = :senderName" : "") +
              (sender.newsletterName ? ", #newsletterName = :newsletterName" : ""),
            ExpressionAttributeNames: {
              "#lastSeen": "lastSeen",
              "#emailCount": "emailCount",
              "#confidence": "confidence",
              ...(sender.name && { "#senderName": "senderName" }),
              ...(sender.newsletterName && {
                "#newsletterName": "newsletterName",
              }),
            },
            ExpressionAttributeValues: marshall({
              ":lastSeen": now,
              ":emailCount": existingSender.emailCount + 1,
              ":confidence": Math.min(100, existingSender.confidence + 5), // Increase confidence
              ...(sender.name && { ":senderName": sender.name }),
              ...(sender.newsletterName && {
                ":newsletterName": sender.newsletterName,
              }),
            }),
          })
        );
      } else {
        // Add new sender
        const newSender: KnownSender = {
          senderEmail: email,
          domain,
          senderName: sender.name,
          newsletterName: sender.newsletterName,
          confirmedAt: now,
          lastSeen: now,
          confidence: 90, // Start with high confidence for confirmed senders
          emailCount: 1,
        };

        await this.client.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: marshall(newSender, { removeUndefinedValues: true }),
          })
        );
      }
    } catch (error) {
      console.error("Error adding confirmed sender:", error);
      throw error;
    }
  }

  async addMultipleConfirmedSenders(
    senders: Array<{
      email: string;
      name?: string;
      newsletterName?: string;
    }>
  ): Promise<void> {
    // Process in batches of 25 (DynamoDB limit)
    const batchSize = 25;
    const now = new Date().toISOString();

    for (let i = 0; i < senders.length; i += batchSize) {
      const batch = senders.slice(i, i + batchSize);
      const putRequests = batch.map((sender) => {
        const email = sender.email.toLowerCase();
        const domain = email.split("@")[1] || "";

        const item: KnownSender = {
          senderEmail: email,
          domain,
          senderName: sender.name,
          newsletterName: sender.newsletterName,
          confirmedAt: now,
          lastSeen: now,
          confidence: 90,
          emailCount: 1,
        };

        return {
          PutRequest: {
            Item: marshall(item, { removeUndefinedValues: true }),
          },
        };
      });

      try {
        await this.client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              [this.tableName]: putRequests,
            },
          })
        );
      } catch (error) {
        console.error("Error batch adding senders:", error);
        // Continue with next batch even if one fails
      }
    }
  }

  async updateSenderConfidence(email: string, confidence: number): Promise<void> {
    try {
      await this.client.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: marshall({ senderEmail: email.toLowerCase() }),
          UpdateExpression: "SET #confidence = :confidence",
          ExpressionAttributeNames: {
            "#confidence": "confidence",
          },
          ExpressionAttributeValues: marshall({
            ":confidence": Math.min(100, Math.max(0, confidence)),
          }),
        })
      );
    } catch (error) {
      console.error("Error updating sender confidence:", error);
    }
  }

  async removeSender(email: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteItemCommand({
          TableName: this.tableName,
          Key: marshall({ senderEmail: email.toLowerCase() }),
        })
      );
    } catch (error) {
      console.error("Error removing sender:", error);
    }
  }
}
