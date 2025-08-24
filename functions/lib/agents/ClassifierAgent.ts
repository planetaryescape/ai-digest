import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import OpenAI from "openai";
import { BATCH_LIMITS, COST_LIMITS, RATE_LIMITS } from "../constants";
import type { CostTracker } from "../cost-tracker";
import { createLogger } from "../logger";
import type { EmailBatch } from "./EmailFetcherAgent";

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

    // Process in batches - increased batch size for better performance
    const batchSize = Math.min(50, RATE_LIMITS.OPENAI_BATCH_SIZE * 2); // Increase batch size
    const batches = this.createBatches(unknownEmails, batchSize);

    // Process batches in parallel (max 3 concurrent) for faster processing
    const batchPromises = batches.map(async (batch, index) => {
      // Small delay between batch starts to avoid rate limits
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, index * 200));
      }

      try {
        const classifications = await this.classifyBatch(batch, isCleanupMode);

        // Store results
        for (const [emailId, classification] of classifications) {
          results.set(emailId, classification);
        }

        // Skip DynamoDB saves for now - they're causing errors and slowdowns
        // await this.saveClassifications(batch, classifications);

        return classifications;
      } catch (error) {
        this.stats.errors++;
        log.error({ error, batchSize: batch.length }, "Batch classification failed");
        return new Map();
      }
    });

    // Process up to 3 batches concurrently
    const concurrentLimit = 3;
    for (let i = 0; i < batchPromises.length; i += concurrentLimit) {
      const chunk = batchPromises.slice(i, i + concurrentLimit);
      await Promise.all(chunk);
    }

    // Log AI-classified senders for debugging
    const aiClassifications = Array.from(results.entries()).filter(
      ([_, c]) => c.classification === "AI"
    );

    const aiSenders = aiClassifications.map(([emailId, c]) => {
      const email = emailBatch.fullEmails.find((e) => e.id === emailId);
      return email?.sender || "Unknown";
    });

    log.info(
      {
        classified: results.size,
        aiEmails: aiClassifications.length,
        aiSenders: aiSenders.slice(0, 20), // Log first 20 for visibility
      },
      "Classification complete"
    );

    // Log all AI senders in batches for complete visibility
    if (aiSenders.length > 0) {
      const senderCounts = aiSenders.reduce(
        (acc, sender) => {
          acc[sender] = (acc[sender] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      log.info(
        {
          totalAISenders: aiSenders.length,
          uniqueSenders: Object.keys(senderCounts).length,
          topSenders: Object.entries(senderCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([sender, count]) => `${sender} (${count})`),
        },
        "AI Email Senders Summary"
      );
    }

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

AI/tech-related SPECIFICALLY includes:
- Artificial Intelligence and Machine Learning content
- AI tools, models, and frameworks (GPT, Claude, LLMs, etc.)
- AI research papers and breakthroughs
- Data science focused on AI/ML
- Automation specifically related to AI
- AI company announcements (OpenAI, Anthropic, etc.)

NOT AI-related (exclude these):
- General tech news without AI focus
- Programming tutorials without AI/ML content
- Generic developer tools (unless AI-specific)
- General software updates
- Hardware news (unless AI chips/processors)
- Web development without AI components
- Generic business/marketing emails

Be STRICT - only classify as AI if the email is specifically about artificial intelligence, machine learning, or directly related AI topics.

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
    // Skip DynamoDB operations if table doesn't exist or is misconfigured
    if (!process.env.DYNAMODB_TABLE || process.env.STORAGE_TYPE === "s3") {
      log.debug("Skipping DynamoDB saves - using alternative storage");
      return;
    }

    const aiSenders: any[] = [];
    const nonAiSenders: any[] = [];

    for (const email of emails) {
      const classification = classifications.get(email.id);
      if (!classification) {
        continue;
      }

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
