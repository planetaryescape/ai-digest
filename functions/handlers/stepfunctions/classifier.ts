import type { Context } from "aws-lambda";
import { ClassifierAgent } from "../../lib/agents/ClassifierAgent";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-classifier");

/**
 * Step Functions handler for classifying unknown senders
 */
export class ClassifierHandler extends BaseStepFunctionHandler {
  private classifier: ClassifierAgent;

  constructor() {
    super();
    this.classifier = new ClassifierAgent(this.costTracker);
  }

  async process(event: any, context: Context): Promise<any> {
    const executionId = event.metadata?.executionId;
    const mode = event.metadata?.mode;
    const startTime = event.metadata?.startTime;

    // Retrieve emails from S3 if needed
    let emails = [];
    if (event.emails) {
      if (
        typeof event.emails === "object" &&
        "type" in event.emails &&
        event.emails.type === "s3"
      ) {
        log.info("Retrieving emails from S3");
        emails = await this.retrieveFromS3(event.emails);
      } else {
        emails = event.emails;
      }
    }

    // Get stats from the previous step
    const stats = event.stats || {};

    // Create an EmailBatch structure that ClassifierAgent expects
    const emailBatch = {
      fullEmails: emails,
      metadata: emails.map((email: any) => ({
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        date: email.date || new Date().toISOString(),
      })),
      aiEmailIds: [],
      unknownEmailIds: [],
      classifications: new Map(),
      stats: event.stats || {}, // Add stats field
    };

    // Add existing classifications based on what the email-fetcher identified
    for (const email of emails) {
      const senderEmail = this.extractEmailAddress(email.sender);
      if (senderEmail) {
        if (email.isKnownAI === true) {
          // This email was already identified as AI by the fetcher
          emailBatch.aiEmailIds.push(email.id);
          emailBatch.classifications.set(senderEmail, {
            classification: "AI",
            confidence: 100,
          });
        } else if (email.isUnknown === true) {
          // This email is from an unknown sender - needs classification
          emailBatch.unknownEmailIds.push(email.id);
          emailBatch.classifications.set(senderEmail, {
            classification: "UNKNOWN",
            confidence: 0,
          });
        } else {
          // This email was identified as non-AI (not in either list)
          emailBatch.classifications.set(senderEmail, {
            classification: "NON_AI",
            confidence: 100,
          });
        }
      }
    }

    log.info(
      {
        totalEmails: emails.length,
        unknownEmails: emailBatch.unknownEmailIds.length,
        aiEmails: emailBatch.aiEmailIds.length,
        mode,
      },
      "Starting classification"
    );

    // Pass cleanup mode flag to classifier for more lenient classification
    // In cleanup mode, we want to cast a wider net for AI content
    const isCleanupMode = mode === "cleanup";

    // Classify unknown emails
    const classificationResults = await this.classifier.classifyEmails(emailBatch, isCleanupMode);

    // Update emails with classification results
    const classifiedEmails = emails.map((email: any) => {
      const classification = classificationResults.get(email.id);
      if (classification) {
        return {
          ...email,
          isAI: classification.classification === "AI",
          classificationConfidence: classification.confidence,
          classificationReasoning: classification.reasoning,
        };
      }
      // Check if this email was already identified as AI by the fetcher
      if (email.isKnownAI === true) {
        return {
          ...email,
          isAI: true,
          classificationConfidence: 100,
          classificationReasoning: "Previously identified as AI sender",
        };
      }
      // Keep existing classification if not updated
      return email;
    });

    // Filter to only AI emails
    const aiEmails = classifiedEmails.filter((email: any) => email.isAI === true);

    log.info(
      {
        totalEmails: classifiedEmails.length,
        aiEmails: aiEmails.length,
        newClassifications: classificationResults.size,
      },
      "Classification complete"
    );

    // Store classified emails in S3 if too large
    let classifiedOutput: any = { emails: aiEmails };
    if (this.shouldUseS3(classifiedOutput)) {
      log.info("Classified emails too large, storing in S3");
      classifiedOutput = await this.storeInS3(
        { emails: aiEmails },
        `${executionId}/classified-${Date.now()}.json`
      );
    }

    const costSoFar = (event.costSoFar || 0) + this.costTracker.getTotalCost();

    return {
      emailCount: aiEmails.length, // Add this for state machine compatibility
      classifiedEmails: classifiedOutput,
      classificationStats: {
        totalEmails: classifiedEmails.length,
        aiEmails: aiEmails.length,
        unknownSenders: emailBatch.unknownEmailIds.length,
        newClassifications: classificationResults.size,
      },
      stats: event.stats || {}, // Pass through stats from previous step
      metadata: {
        executionId,
        mode,
        startTime,
      },
      costSoFar,
    };
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
}

// Export handler for Lambda
const handler = new ClassifierHandler();
export const lambdaHandler = handler.handler.bind(handler);
