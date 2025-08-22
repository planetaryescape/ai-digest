import type { Context } from "aws-lambda";
import { ContentExtractorAgent } from "../../lib/agents/ContentExtractorAgent";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-content-extractor");

/**
 * Step Functions handler for extracting content from email links
 */
export class ContentExtractorHandler extends BaseStepFunctionHandler {
  private extractor: ContentExtractorAgent;

  constructor() {
    super();
    this.extractor = new ContentExtractorAgent(this.costTracker);
  }

  async process(event: any, _context: Context): Promise<any> {
    const executionId = event.metadata?.executionId;
    const mode = event.metadata?.mode;
    const startTime = event.metadata?.startTime;

    // Retrieve classified emails from S3 if needed
    let classifiedEmails = { emails: [] };
    if (event.classifiedEmails) {
      if (
        typeof event.classifiedEmails === "object" &&
        "type" in event.classifiedEmails &&
        event.classifiedEmails.type === "s3"
      ) {
        log.info("Retrieving classified emails from S3");
        classifiedEmails = await this.retrieveFromS3(event.classifiedEmails);
      } else {
        classifiedEmails = event.classifiedEmails;
      }
    }

    const emails = classifiedEmails.emails || [];

    log.info({ emailCount: emails.length }, "Starting content extraction");

    // Extract content from email links
    const extractionStartTime = Date.now();
    const articles = await this.extractor.extractArticles(emails);
    const extractionTime = Date.now() - extractionStartTime;

    const successfulExtractions = articles.filter((a: any) => a.extractedSuccessfully).length;

    log.info(
      {
        totalArticles: articles.length,
        successfulExtractions,
        failedExtractions: articles.length - successfulExtractions,
        extractionTime,
      },
      "Content extraction complete"
    );

    // Store articles in S3 if too large
    let articlesOutput: any = articles;
    if (this.shouldUseS3(articles)) {
      log.info("Articles too large, storing in S3");
      articlesOutput = await this.storeInS3(articles, `${executionId}/articles-${Date.now()}.json`);
    }

    const costSoFar = (event.costSoFar || 0) + this.costTracker.getTotalCost();

    return {
      executionId, // Add at top level for Step Functions
      articles: articlesOutput,
      extractionStats: {
        totalArticles: articles.length,
        successfulExtractions,
        failedExtractions: articles.length - successfulExtractions,
        extractionTime,
      },
      metadata: {
        executionId,
        mode,
        startTime,
      },
      costSoFar,
    };
  }
}

// Export handler for Lambda
const handler = new ContentExtractorHandler();
export const lambdaHandler = handler.handler.bind(handler);
