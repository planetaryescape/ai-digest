import OpenAI from "openai";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { CostTracker } from "../cost-tracker";
import { createLogger } from "../logger";
import { COST_LIMITS, RATE_LIMITS, BATCH_LIMITS } from "../constants";
import { EmailBatch } from "./EmailFetcherAgent";

const log = createLogger("ClassifierAgent");

export interface Classification {
  classification: "AI" | "NON_AI" | "UNKNOWN";
  confidence: number;
  reasoning?: string;
}

export class ClassifierAgent {
  private openai: OpenAI;
  private dynamodb: DynamoDBDocumentClient;
  private stats = {
    emailsClassified: 0,
    apiCallsMade: 0,
    errors: 0,
  };

  constructor(private costTracker: CostTracker) {
    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize DynamoDB
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
    this.dynamodb = DynamoDBDocumentClient.from(dynamoClient);
  }

  async classifyEmails(
    emailBatch: EmailBatch,
    isCleanupMode = false
  ): Promise<Map<string, Classification>> {
    log.info(
      {
        totalEmails: emailBatch.fullEmails.length,
        unknownEmails: emailBatch.unknownEmailIds.length,
        isCleanupMode,
      },
      "Starting email classification"
    );

    const results = new Map<string, Classification>();

    // Only classify unknown emails
    const unknownEmails = emailBatch.fullEmails.filter((email) =>
      emailBatch.unknownEmailIds.includes(email.id)
    );

    if (unknownEmails.length === 0) {
      log.info("No unknown emails to classify");
      return results;
    }

    // Process in batches
    const batches = this.createBatches(unknownEmails, RATE_LIMITS.OPENAI_BATCH_SIZE);
    
    for (const batch of batches) {
      try {
        const classifications = await this.classifyBatch(batch, isCleanupMode);
        
        // Store results
        for (const [emailId, classification] of classifications) {
          results.set(emailId, classification);
        }

        // Save new classifications to DynamoDB
        await this.saveClassifications(batch, classifications);

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        this.stats.errors++;
        log.error({ error, batchSize: batch.length }, "Batch classification failed");
      }
    }

    log.info(
      {
        classified: results.size,
        aiEmails: Array.from(results.values()).filter((c) => c.classification === "AI").length,
      },
      "Classification complete"
    );

    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private async classifyBatch(
    emails: any[],
    isCleanupMode: boolean
  ): Promise<Map<string, Classification>> {
    const classifications = new Map<string, Classification>();

    // Prepare email summaries for classification
    const emailSummaries = emails.map((email) => ({
      id: email.id,
      sender: email.sender,
      subject: email.subject,
      snippet: email.snippet?.substring(0, 200),
    }));

    const prompt = this.buildClassificationPrompt(emailSummaries, isCleanupMode);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an email classifier that determines if emails are AI/tech-related or not. Respond with JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      this.stats.apiCallsMade++;
      this.costTracker.recordApiCall("openai", "classify", COST_LIMITS.OPENAI_GPT4O_MINI_COST);

      const result = JSON.parse(response.choices[0].message.content || "{}");

      // Process classifications
      for (const email of emails) {
        const classification = result[email.id] || {
          classification: "UNKNOWN",
          confidence: 0,
        };

        classifications.set(email.id, {
          classification: classification.classification || "UNKNOWN",
          confidence: classification.confidence || 0,
          reasoning: classification.reasoning,
        });

        this.stats.emailsClassified++;
      }
    } catch (error) {
      log.error({ error }, "OpenAI classification failed");
      throw error;
    }

    return classifications;
  }

  private buildClassificationPrompt(emailSummaries: any[], isCleanupMode: boolean): string {
    const mode = isCleanupMode ? "cleanup (be more inclusive)" : "regular";
    
    return `Classify these emails as AI/tech-related or not. Mode: ${mode}

AI/tech-related includes:
- AI/ML news, tools, research
- Tech industry updates
- Developer tools and frameworks
- Data science content
- Automation and robotics
- Tech company announcements
- Programming languages and libraries

Return JSON with email ID as key:
{
  "emailId": {
    "classification": "AI" | "NON_AI",
    "confidence": 0-100,
    "reasoning": "brief explanation"
  }
}

Emails to classify:
${JSON.stringify(emailSummaries, null, 2)}`;
  }

  private async saveClassifications(
    emails: any[],
    classifications: Map<string, Classification>
  ): Promise<void> {
    const aiSenders: any[] = [];
    const nonAiSenders: any[] = [];

    for (const email of emails) {
      const classification = classifications.get(email.id);
      if (!classification) continue;

      const senderEmail = this.extractEmailAddress(email.sender);
      const senderData = {
        pk: "SENDER",
        sk: senderEmail,
        email: senderEmail,
        name: email.sender,
        classification: classification.classification,
        confidence: classification.confidence,
        classifiedAt: new Date().toISOString(),
      };

      if (classification.classification === "AI" && classification.confidence >= 70) {
        aiSenders.push(senderData);
      } else if (classification.classification === "NON_AI" && classification.confidence >= 70) {
        nonAiSenders.push(senderData);
      }
    }

    // Save to DynamoDB in batches
    if (aiSenders.length > 0) {
      await this.batchSaveToDynamoDB("ai-digest-known-ai-senders", aiSenders);
    }

    if (nonAiSenders.length > 0) {
      await this.batchSaveToDynamoDB("ai-digest-known-non-ai-senders", nonAiSenders);
    }
  }

  private async batchSaveToDynamoDB(tableName: string, items: any[]): Promise<void> {
    const batches = this.createBatches(items, BATCH_LIMITS.DYNAMODB_WRITE);

    for (const batch of batches) {
      try {
        const putRequests = batch.map((item) => ({
          PutRequest: { Item: item },
        }));

        await this.dynamodb.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: putRequests,
            },
          })
        );

        log.info({ tableName, count: batch.length }, "Saved classifications to DynamoDB");
      } catch (error) {
        log.error({ error, tableName }, "Failed to save classifications");
      }
    }
  }

  private extractEmailAddress(sender: string): string {
    const match = sender.match(/<(.+?)>/) || sender.match(/([^\s]+@[^\s]+)/);
    return match ? match[1].toLowerCase() : sender.toLowerCase();
  }

  getStats() {
    return { ...this.stats };
  }
}