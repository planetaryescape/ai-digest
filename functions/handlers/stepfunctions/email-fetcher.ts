import type { Context } from "aws-lambda";
import { EmailFetcherAgent } from "../../lib/agents/EmailFetcherAgent";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-email-fetcher");

/**
 * Step Functions handler for fetching emails
 */
export class EmailFetcherHandler extends BaseStepFunctionHandler {
  private emailFetcher: EmailFetcherAgent;

  constructor() {
    super();
    this.emailFetcher = new EmailFetcherAgent(this.costTracker);
  }

  async process(event: any, _context: Context): Promise<any> {
    // Extract input parameters (handle both direct and nested input)
    const input = event.input || event;
    const mode = input.mode || "weekly";
    const batchSize = input.batchSize;
    const cleanup = input.cleanup;
    const executionId = event.executionId;
    const startTime = event.startTime || new Date().toISOString();

    // Add historical mode parameters
    const startDate = input.startDate;
    const endDate = input.endDate;

    log.info(
      {
        mode,
        batchSize,
        cleanup,
        executionId,
        startDate,
        endDate,
      },
      "Starting email fetch"
    );

    // Fetch emails based on mode and parameters
    const fetchResult = await this.emailFetcher.fetchEmails({
      mode,
      batchSize,
      cleanup,
      executionId,
      startDate, // Pass date range
      endDate, // Pass date range
    });

    log.info(
      {
        totalEmails: fetchResult.fullEmails.length,
        aiEmails: fetchResult.aiEmailIds.length,
        unknownSenders: fetchResult.unknownEmailIds.length,
      },
      "Email fetch complete"
    );

    // Store in S3 if too large
    let _emailsOutput: any = fetchResult.fullEmails;
    if (this.shouldUseS3(fetchResult.fullEmails)) {
      log.info("Emails too large, storing in S3");
      _emailsOutput = await this.storeInS3(
        fetchResult.fullEmails,
        `${executionId}/emails-${Date.now()}.json`
      );
    }

    // Mark emails with their initial classification status
    const markedEmails = fetchResult.fullEmails.map((email: any) => ({
      ...email,
      isKnownAI: fetchResult.aiEmailIds.includes(email.id),
      isUnknown: fetchResult.unknownEmailIds.includes(email.id),
    }));

    // Store marked emails in S3 if too large
    let markedEmailsOutput: any = markedEmails;
    if (this.shouldUseS3(markedEmails)) {
      log.info("Marked emails too large, storing in S3");
      markedEmailsOutput = await this.storeInS3(
        markedEmails,
        `${executionId}/marked-emails-${Date.now()}.json`
      );
    }

    return {
      emailCount: fetchResult.fullEmails.length,
      emails: markedEmailsOutput,
      stats: {
        totalFetched: fetchResult.fullEmails.length,
        aiEmails: fetchResult.aiEmailIds.length,
        unknownSenders: fetchResult.unknownEmailIds.length,
        fetchTime: Date.now() - new Date(startTime).getTime(),
      },
      metadata: {
        executionId,
        mode,
        startTime,
      },
      costSoFar: this.costTracker.getTotalCost(),
    };
  }
}

// Export handler for Lambda
const handler = new EmailFetcherHandler();
export const lambdaHandler = handler.handler.bind(handler);
