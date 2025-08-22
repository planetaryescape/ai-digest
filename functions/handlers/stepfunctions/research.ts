import type { Context } from "aws-lambda";
import { ResearchAgent } from "../../lib/agents/ResearchAgent";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-research");

/**
 * Step Functions handler for research enrichment
 */
export class ResearchHandler extends BaseStepFunctionHandler {
  private researcher: ResearchAgent;

  constructor() {
    super();
    this.researcher = new ResearchAgent(this.costTracker);
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

    log.info({ emailCount: emails.length }, "Starting research enrichment");

    // Perform research on emails
    const researchStartTime = Date.now();
    const researchData = await this.researcher.enrichWithResearch(emails);
    const researchTime = Date.now() - researchStartTime;

    log.info(
      {
        totalSearches: researchData.length,
        researchTime,
      },
      "Research enrichment complete"
    );

    // Store research data in S3 if too large
    let researchOutput: any = researchData;
    if (this.shouldUseS3(researchData)) {
      log.info("Research data too large, storing in S3");
      researchOutput = await this.storeInS3(
        researchData,
        `${executionId}/research-${Date.now()}.json`
      );
    }

    const costSoFar = (event.costSoFar || 0) + this.costTracker.getTotalCost();

    return {
      executionId, // Add at top level for Step Functions
      researchData: researchOutput,
      researchStats: {
        totalSearches: researchData.length,
        researchTime,
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
const handler = new ResearchHandler();
export const lambdaHandler = handler.handler.bind(handler);
