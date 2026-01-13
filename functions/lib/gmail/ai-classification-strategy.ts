import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ISenderTracker } from "../interfaces/sender-tracker";
import { createLogger } from "../logger";
import type { AIDetectionStrategy } from "./ai-detection-strategies";

const log = createLogger("ai-classification");

/**
 * Schema for AI classification result
 */
const ClassificationResultSchema = z.object({
  isAIRelated: z.boolean().describe("Is this email about AI/ML topics?"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  reasoning: z.string().describe("Brief explanation of the decision"),
  topics: z.array(z.string()).optional().describe("AI topics mentioned if any"),
});

/**
 * AI-powered email classification strategy
 * Uses a small language model to accurately classify emails
 */
export class AIClassificationStrategy implements AIDetectionStrategy {
  private model: string;
  private cache: Map<string, boolean> = new Map();

  constructor(model: string = "gpt-4o-mini") {
    this.model = model;
  }

  async detect(subject: string, sender: string, senderTracker?: ISenderTracker): Promise<boolean> {
    // Check cache first
    const cacheKey = `${subject}:${sender}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? false;
    }

    // Skip classification for very short subjects
    if (!subject || subject.length < 10) {
      return false;
    }

    try {
      const { object } = await generateObject({
        model: openai(this.model),
        schema: ClassificationResultSchema,
        temperature: 0.1, // Low temperature for consistent classification
        prompt: `Classify if this email is about AI/ML/artificial intelligence topics.

Email details:
Subject: ${subject}
Sender: ${sender}

Is this email a newsletter, update, or communication about artificial intelligence, machine learning, LLMs, AI tools, AI research, or related topics?

Consider:
- AI company announcements
- AI tool updates
- Machine learning research
- AI industry news
- AI product launches
- Developer tools for AI
- AI tutorials/education

Do NOT classify as AI-related:
- General tech news without AI focus
- Marketing emails using "AI" as buzzword
- Non-tech newsletters
- Regular product updates unless specifically about AI features`,
      });

      const result = object.isAIRelated && object.confidence >= 0.7;

      // Cache the result
      this.cache.set(cacheKey, result);

      // If we have a sender tracker and high confidence, update it
      if (senderTracker && object.confidence >= 0.9) {
        const senderEmail = this.extractEmailAddress(sender);
        if (senderEmail) {
          if (result) {
            await senderTracker.addConfirmedSender({ email: senderEmail });
          }
        }
      }

      return result;
    } catch (error) {
      log.error({ error }, "AI classification failed, falling back to false");
      return false;
    }
  }

  private extractEmailAddress(sender: string): string | null {
    const match = sender.match(/<([^>]+)>/);
    if (match) {
      return match[1].toLowerCase();
    }
    if (sender.includes("@")) {
      return sender.toLowerCase();
    }
    return null;
  }

  /**
   * Clear the classification cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Batch AI classification for efficiency
 */
export class BatchAIClassificationStrategy {
  private model: string;

  constructor(model: string = "gpt-4o-mini") {
    this.model = model;
  }

  /**
   * Classify multiple emails in a single API call
   */
  async classifyBatch(
    emails: Array<{ subject: string; sender: string; id: string }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Process in batches of 10 for efficiency
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      try {
        const { object } = await generateObject({
          model: openai(this.model),
          schema: z.object({
            classifications: z.array(
              z.object({
                id: z.string(),
                isAIRelated: z.boolean(),
                confidence: z.number(),
              })
            ),
          }),
          temperature: 0.1,
          prompt: `Classify which emails are about AI/ML topics.

Emails to classify:
${batch
  .map(
    (email, idx) =>
      `${idx + 1}. ID: ${email.id}
   Subject: ${email.subject}
   Sender: ${email.sender}`
  )
  .join("\n\n")}

For each email, determine if it's about AI/ML/artificial intelligence.
Include newsletters, updates, and communications about AI topics.
Exclude general tech news without AI focus and marketing using AI as a buzzword.`,
        });

        // Store results
        for (const classification of object.classifications) {
          results.set(
            classification.id,
            classification.isAIRelated && classification.confidence >= 0.7
          );
        }
      } catch (error) {
        log.error({ error }, "Batch classification failed for batch");
        // Default to false for failed batch
        for (const email of batch) {
          results.set(email.id, false);
        }
      }
    }

    return results;
  }
}
