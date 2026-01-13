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
import { createLogger } from "../logger";

const log = createLogger("enhanced-sender-tracker");

// AI Digest's own email - exclude from tracking to prevent circular references
const AI_DIGEST_EMAIL = "ai-digest@journaler.me";

/**
 * Sanitize value for DynamoDB - replace empty strings with a default
 */
function sanitizeForDynamoDB(
  value: string | undefined | null,
  defaultValue: string = "unknown"
): string {
  if (!value || value.trim() === "") {
    return defaultValue;
  }
  return value;
}

/**
 * Extract domain from email safely
 */
function extractDomain(email: string): string {
  const parts = email.toLowerCase().split("@");
  return parts.length > 1 && parts[1] ? parts[1] : "unknown-domain";
}

export interface SenderClassification {
  senderEmail: string;
  classification: "AI" | "NON_AI" | "UNKNOWN";
  confidence: number;
  lastClassified: number;
  classificationCount: number;
  domain?: string;
  senderName?: string;
  newsletterName?: string;
  ttl?: number;
}

export interface NonAISender {
  senderEmail: string;
  domain: string;
  confidence: number;
  lastClassified: number;
  classificationCount: number;
  senderName?: string;
  ttl?: number;
}

/**
 * Enhanced sender tracker with non-AI tracking and confidence decay
 */
export class EnhancedSenderTracker implements ISenderTracker {
  private client: DynamoDBClient;
  private aiSendersTable: string;
  private nonAiSendersTable: string;
  private confidenceDecayRate = 2; // Lose 2% confidence per day
  private confidenceThreshold = 50; // Re-classify if confidence drops below 50%
  private ttlDays = 90; // Auto-delete after 90 days

  constructor() {
    this.client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.aiSendersTable = process.env.DYNAMODB_TABLE || "ai-digest-known-ai-senders";
    this.nonAiSendersTable = process.env.DYNAMODB_NON_AI_TABLE || "ai-digest-known-non-ai-senders";
  }

  /**
   * Classify a sender based on known data and confidence decay
   */
  async classifySender(email: string): Promise<SenderClassification> {
    const senderEmail = email.toLowerCase();

    // Skip AI Digest's own email
    if (senderEmail === AI_DIGEST_EMAIL) {
      log.debug(`Skipping AI Digest email classification: ${senderEmail}`);
      return {
        classification: "UNKNOWN",
        senderEmail,
        confidence: 0,
        lastClassified: Date.now(),
        classificationCount: 0,
      };
    }

    // Check AI senders
    const aiSender = await this.checkAISender(senderEmail);
    if (aiSender && this.isConfidenceValid(aiSender)) {
      return {
        classification: "AI",
        senderEmail,
        confidence: this.getAdjustedConfidence(aiSender),
        lastClassified: aiSender.lastClassified,
        classificationCount: aiSender.classificationCount || 1,
        domain: aiSender.domain,
        senderName: aiSender.senderName,
        newsletterName: aiSender.newsletterName,
      };
    }

    // Check non-AI senders
    const nonAiSender = await this.checkNonAISender(senderEmail);
    if (nonAiSender && this.isConfidenceValid(nonAiSender)) {
      return {
        classification: "NON_AI",
        senderEmail,
        confidence: this.getAdjustedConfidence(nonAiSender),
        lastClassified: nonAiSender.lastClassified,
        classificationCount: nonAiSender.classificationCount || 1,
        domain: nonAiSender.domain,
        senderName: nonAiSender.senderName,
      };
    }

    // Unknown - needs classification
    return {
      classification: "UNKNOWN",
      senderEmail,
      confidence: 0,
      lastClassified: 0,
      classificationCount: 0,
    };
  }

  /**
   * Check if sender is a known AI sender
   */
  private async checkAISender(email: string): Promise<SenderClassification | null> {
    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: this.aiSendersTable,
          Key: marshall({ senderEmail: email }),
        })
      );

      if (response.Item) {
        const sender = unmarshall(response.Item) as any;
        return {
          classification: "AI",
          senderEmail: sender.senderEmail,
          confidence: sender.confidence || 100,
          lastClassified: sender.confirmedAt ? new Date(sender.confirmedAt).getTime() : Date.now(),
          classificationCount: sender.emailCount || 1,
          domain: sender.domain,
          senderName: sender.senderName,
          newsletterName: sender.newsletterName,
        };
      }

      return null;
    } catch (error) {
      log.error({ error }, "Error checking AI sender");
      return null;
    }
  }

  /**
   * Check if sender is a known non-AI sender
   */
  private async checkNonAISender(email: string): Promise<NonAISender | null> {
    try {
      const response = await this.client.send(
        new GetItemCommand({
          TableName: this.nonAiSendersTable,
          Key: marshall({ senderEmail: email }),
        })
      );

      if (response.Item) {
        return unmarshall(response.Item) as NonAISender;
      }

      return null;
    } catch (error) {
      log.error({ error }, "Error checking non-AI sender");
      return null;
    }
  }

  /**
   * Calculate confidence with decay
   */
  private getAdjustedConfidence(sender: { confidence: number; lastClassified: number }): number {
    const daysSinceClassified = (Date.now() - sender.lastClassified) / (1000 * 60 * 60 * 24);
    const confidenceDecay = daysSinceClassified * this.confidenceDecayRate;
    return Math.max(0, sender.confidence - confidenceDecay);
  }

  /**
   * Check if confidence is still valid
   */
  private isConfidenceValid(sender: { confidence: number; lastClassified: number }): boolean {
    const adjustedConfidence = this.getAdjustedConfidence(sender);
    return adjustedConfidence >= this.confidenceThreshold;
  }

  /**
   * Add or update a non-AI sender
   */
  async addNonAISender(sender: {
    email: string;
    confidence?: number;
    name?: string;
  }): Promise<void> {
    const email = sender.email.toLowerCase();

    // Skip AI Digest's own email
    if (email === AI_DIGEST_EMAIL) {
      log.debug(`Skipping AI Digest email from non-AI senders: ${email}`);
      return;
    }
    const domain = extractDomain(email);
    const now = Date.now();
    const ttl = Math.floor(now / 1000) + this.ttlDays * 24 * 60 * 60;

    try {
      // Check if already exists
      const existing = await this.checkNonAISender(email);

      await this.client.send(
        new PutItemCommand({
          TableName: this.nonAiSendersTable,
          Item: marshall({
            senderEmail: email,
            domain,
            senderName: sender.name || existing?.senderName || email,
            confidence: sender.confidence || 90,
            lastClassified: now,
            classificationCount: (existing?.classificationCount || 0) + 1,
            ttl,
          }),
        })
      );

      log.info(`Added/updated non-AI sender: ${email}`);
    } catch (error) {
      log.error({ error }, "Error adding non-AI sender");
      throw error;
    }
  }

  /**
   * Batch add multiple non-AI senders
   */
  async addMultipleNonAISenders(
    senders: Array<{
      email: string;
      confidence?: number;
      name?: string;
    }>
  ): Promise<void> {
    // Filter out AI Digest email
    const filteredSenders = senders.filter((s) => {
      const email = s.email.toLowerCase();
      if (email === AI_DIGEST_EMAIL) {
        log.debug(`Filtering out AI Digest email from batch: ${email}`);
        return false;
      }
      return true;
    });

    if (filteredSenders.length === 0) return;

    const now = Date.now();
    const ttl = Math.floor(now / 1000) + this.ttlDays * 24 * 60 * 60;

    // Process in batches of 25 (DynamoDB limit)
    const batchSize = 25;
    for (let i = 0; i < filteredSenders.length; i += batchSize) {
      const batch = filteredSenders.slice(i, i + batchSize);
      const putRequests = batch.map((sender) => ({
        PutRequest: {
          Item: marshall({
            senderEmail: sender.email.toLowerCase(),
            domain: extractDomain(sender.email),
            senderName: sanitizeForDynamoDB(sender.name, sender.email),
            confidence: sender.confidence || 90,
            lastClassified: now,
            classificationCount: 1,
            ttl,
          }),
        },
      }));

      try {
        await this.client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              [this.nonAiSendersTable]: putRequests,
            },
          })
        );
        log.info(`Added batch of ${batch.length} non-AI senders`);
      } catch (error) {
        log.error({ error }, "Error batch adding non-AI senders");
      }
    }
  }

  /**
   * ISenderTracker interface implementations (for AI senders)
   */
  async isKnownAISender(email: string): Promise<boolean> {
    const classification = await this.classifySender(email);
    return classification.classification === "AI";
  }

  async getAllKnownSenders(): Promise<KnownSender[]> {
    try {
      const response = await this.client.send(
        new ScanCommand({
          TableName: this.aiSendersTable,
        })
      );

      if (!response.Items) {
        return [];
      }

      return response.Items.map((item) => unmarshall(item) as KnownSender);
    } catch (error) {
      log.error({ error }, "Error getting all known senders");
      return [];
    }
  }

  async getKnownSendersByDomain(domain: string): Promise<KnownSender[]> {
    try {
      const response = await this.client.send(
        new QueryCommand({
          TableName: this.aiSendersTable,
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
      log.error({ error }, "Error getting senders by domain");
      return [];
    }
  }

  async addConfirmedSender(sender: {
    email: string;
    name?: string;
    newsletterName?: string;
  }): Promise<void> {
    const email = sender.email.toLowerCase();

    // Skip AI Digest's own email
    if (email === AI_DIGEST_EMAIL) {
      log.debug(`Skipping AI Digest email from confirmed senders: ${email}`);
      return;
    }
    const domain = extractDomain(email);
    const now = new Date().toISOString();

    try {
      // Check if already exists
      const existing = await this.checkAISender(email);
      const emailCount = (existing?.classificationCount || 0) + 1;

      // Update with incremented confidence
      const newConfidence = Math.min(100, (existing?.confidence || 70) + 5);

      await this.client.send(
        new UpdateItemCommand({
          TableName: this.aiSendersTable,
          Key: marshall({ senderEmail: email }),
          UpdateExpression:
            "SET #domain = :domain, #senderName = :senderName, #confirmedAt = :confirmedAt, " +
            "#confidence = :confidence, #lastSeen = :lastSeen, #emailCount = :emailCount" +
            (sender.newsletterName ? ", #newsletterName = :newsletterName" : ""),
          ExpressionAttributeNames: {
            "#domain": "domain",
            "#senderName": "senderName",
            "#confirmedAt": "confirmedAt",
            "#confidence": "confidence",
            "#lastSeen": "lastSeen",
            "#emailCount": "emailCount",
            ...(sender.newsletterName && { "#newsletterName": "newsletterName" }),
          },
          ExpressionAttributeValues: marshall({
            ":domain": domain,
            ":senderName": sanitizeForDynamoDB(sender.name, email),
            ":confirmedAt": now,
            ":confidence": newConfidence,
            ":lastSeen": now,
            ":emailCount": emailCount,
            ...(sender.newsletterName && {
              ":newsletterName": sanitizeForDynamoDB(sender.newsletterName),
            }),
          }),
        })
      );

      log.info(`Updated AI sender: ${email} (confidence: ${newConfidence})`);
    } catch (error) {
      log.error({ error }, "Error adding confirmed sender");
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
    // Filter out AI Digest email
    const filteredSenders = senders.filter((s) => {
      const email = s.email.toLowerCase();
      if (email === AI_DIGEST_EMAIL) {
        log.debug(`Filtering out AI Digest email from confirmed senders batch: ${email}`);
        return false;
      }
      return true;
    });

    for (const sender of filteredSenders) {
      await this.addConfirmedSender(sender);
    }
  }

  async updateSenderConfidence(email: string, confidence: number): Promise<void> {
    const senderEmail = email.toLowerCase();
    const classification = await this.classifySender(senderEmail);

    if (classification.classification === "UNKNOWN") {
      log.warn(`Cannot update confidence for unknown sender: ${senderEmail}`);
      return;
    }

    const tableName =
      classification.classification === "AI" ? this.aiSendersTable : this.nonAiSendersTable;

    try {
      await this.client.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: marshall({ senderEmail }),
          UpdateExpression: "SET #confidence = :confidence, #lastClassified = :lastClassified",
          ExpressionAttributeNames: {
            "#confidence": "confidence",
            "#lastClassified":
              classification.classification === "AI" ? "confirmedAt" : "lastClassified",
          },
          ExpressionAttributeValues: marshall({
            ":confidence": confidence,
            ":lastClassified":
              classification.classification === "AI" ? new Date().toISOString() : Date.now(),
          }),
        })
      );

      log.info(`Updated confidence for ${senderEmail} to ${confidence}`);
    } catch (error) {
      log.error({ error }, "Error updating sender confidence");
      throw error;
    }
  }

  async removeSender(email: string): Promise<void> {
    const senderEmail = email.toLowerCase();
    const classification = await this.classifySender(senderEmail);

    if (classification.classification === "UNKNOWN") {
      log.warn(`Cannot remove unknown sender: ${senderEmail}`);
      return;
    }

    const tableName =
      classification.classification === "AI" ? this.aiSendersTable : this.nonAiSendersTable;

    try {
      await this.client.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: marshall({ senderEmail }),
        })
      );

      log.info(`Removed sender: ${senderEmail}`);
    } catch (error) {
      log.error({ error }, "Error removing sender");
      throw error;
    }
  }

  /**
   * Get all non-AI senders (for reporting/debugging)
   */
  async getAllNonAISenders(): Promise<NonAISender[]> {
    try {
      const response = await this.client.send(
        new ScanCommand({
          TableName: this.nonAiSendersTable,
        })
      );

      if (!response.Items) {
        return [];
      }

      return response.Items.map((item) => unmarshall(item) as NonAISender);
    } catch (error) {
      log.error({ error }, "Error getting all non-AI senders");
      return [];
    }
  }

  /**
   * Clean up old senders with low confidence
   */
  async cleanupOldSenders(): Promise<void> {
    try {
      // Scan for senders with low confidence
      const aiSenders = await this.getAllKnownSenders();
      const nonAiSenders = await this.getAllNonAISenders();

      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      // Remove AI senders with low confidence and old classification
      for (const sender of aiSenders) {
        const lastSeen = new Date(sender.lastSeen || sender.confirmedAt).getTime();
        if (lastSeen < thirtyDaysAgo && sender.confidence < 50) {
          await this.removeSender(sender.senderEmail);
          log.info(`Cleaned up old AI sender: ${sender.senderEmail}`);
        }
      }

      // Remove non-AI senders with low confidence and old classification
      for (const sender of nonAiSenders) {
        if (sender.lastClassified < thirtyDaysAgo && sender.confidence < 50) {
          await this.removeSender(sender.senderEmail);
          log.info(`Cleaned up old non-AI sender: ${sender.senderEmail}`);
        }
      }
    } catch (error) {
      log.error({ error }, "Error cleaning up old senders");
    }
  }
}
