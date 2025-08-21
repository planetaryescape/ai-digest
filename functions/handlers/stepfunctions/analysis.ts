import type { Context } from "aws-lambda";
import { AnalysisAgent } from "../../lib/agents/AnalysisAgent";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-analysis");

/**
 * Step Functions handler for email analysis
 */
export class AnalysisHandler extends BaseStepFunctionHandler {
  private analysisAgent: AnalysisAgent;

  constructor() {
    super();
    this.analysisAgent = new AnalysisAgent(this.costTracker);
  }

  async process(event: any, context: Context): Promise<any> {
    const executionId = event.metadata?.executionId;
    const startTime = event.metadata?.startTime;

    // Handle parallel enrichment results
    const [extractionResult, researchResult] = event.enrichment || [{}, {}];

    log.info(
      {
        executionId,
        articlesCount: extractionResult.extractionStats?.totalArticles,
        researchCount: researchResult.researchStats?.totalSearches,
      },
      "Starting deep analysis"
    );

    // Retrieve articles from S3 if needed
    let articles = [];
    if (extractionResult.articles) {
      if (
        typeof extractionResult.articles === "object" &&
        "type" in extractionResult.articles &&
        extractionResult.articles.type === "s3"
      ) {
        log.info("Retrieving articles from S3");
        articles = await this.retrieveFromS3(extractionResult.articles);
      } else {
        articles = extractionResult.articles;
      }
    }

    // Retrieve research data from S3 if needed
    let researchData = [];
    if (researchResult.researchData) {
      if (
        typeof researchResult.researchData === "object" &&
        "type" in researchResult.researchData &&
        researchResult.researchData.type === "s3"
      ) {
        log.info("Retrieving research data from S3");
        researchData = await this.retrieveFromS3(researchResult.researchData);
      } else {
        researchData = researchResult.researchData;
      }
    }

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

    // The articles array contains emails with their articles already embedded
    // researchData also contains emails with research embedded
    // We need to merge these structures properly
    const enrichedEmails = classifiedEmails.emails.map((email: any) => {
      // Find the matching email in articles array (which has articles embedded)
      const articleEmail = articles.find((a: any) => a.id === email.id);
      // Find the matching email in research data (which has research embedded)
      const researchEmail = researchData.find((r: any) => r.id === email.id);

      return {
        ...email,
        // Use the articles from the extraction result (already on the email object)
        articles: articleEmail?.articles || email.articles || [],
        // Add any research data
        research: researchEmail?.research || [],
      };
    });

    log.info(
      {
        emailCount: enrichedEmails.length,
        totalArticles: articles.length,
        totalResearch: researchData.length,
      },
      "Performing deep analysis"
    );

    // Perform analysis using the correct method name
    const analysisStartTime = Date.now();
    const analysisResult = await this.analysisAgent.analyzeContent(enrichedEmails); // Fixed: using analyzeContent instead of analyzeEmails
    const analysisTime = Date.now() - analysisStartTime;

    log.info(
      {
        keyDevelopments: analysisResult.analysis.keyDevelopments.length,
        patterns: analysisResult.analysis.patterns.length,
        analysisTime,
        model: analysisResult.metadata.modelUsed,
      },
      "Analysis complete"
    );

    // Store in S3 if too large
    let analysisOutput;
    if (this.shouldUseS3(analysisResult)) {
      log.info("Analysis result too large, storing in S3");
      analysisOutput = await this.storeInS3(
        analysisResult,
        `${executionId}/analysis-${Date.now()}.json`
      );
    } else {
      analysisOutput = analysisResult;
    }

    // Calculate cumulative cost
    const costSoFar =
      Math.max(extractionResult.costSoFar || 0, researchResult.costSoFar || 0) +
      this.costTracker.getTotalCost();

    return {
      executionId,  // Add at top level for Step Functions
      analysisResult: analysisOutput,
      analysisStats: {
        articlesAnalyzed: articles.length,
        researchDataUsed: researchData.length,
        analysisTime,
        modelUsed: analysisResult.metadata.modelUsed,
      },
      metadata: {
        executionId,
        mode: event.metadata?.mode,
        totalPipelineTime: Date.now() - startTime,
      },
      costSoFar,
    };
  }
}

// Export handler for Lambda
const handler = new AnalysisHandler();
export const lambdaHandler = handler.handler.bind(handler);
