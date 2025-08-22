import type { Context } from "aws-lambda";
import { CriticAgent } from "../../lib/agents/CriticAgent";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-critic");

/**
 * Step Functions handler for critic analysis
 */
export class CriticHandler extends BaseStepFunctionHandler {
  private critic: CriticAgent;

  constructor() {
    super();
    this.critic = new CriticAgent(this.costTracker);
  }

  async process(event: any, _context: Context): Promise<any> {
    const executionId = event.metadata?.executionId;
    const mode = event.metadata?.mode;
    const startTime = event.metadata?.startTime;

    // Retrieve analysis result from S3 if needed
    let analysisResult = event.analysisResult;
    if (
      analysisResult &&
      typeof analysisResult === "object" &&
      "type" in analysisResult &&
      analysisResult.type === "s3"
    ) {
      log.info("Retrieving analysis result from S3");
      analysisResult = await this.retrieveFromS3(analysisResult);
    }

    if (!analysisResult || !analysisResult.analysis) {
      log.warn("No analysis result provided, skipping critique");
      return {
        analysisResult,
        criticResult: null,
        criticStats: {
          skipped: true,
          reason: "No analysis result",
        },
        metadata: {
          executionId,
          mode,
          totalPipelineTime: Date.now() - startTime,
        },
        costSoFar: event.costSoFar || 0,
      };
    }

    log.info("Generating opinionated critique");

    // Generate critique
    const criticStartTime = Date.now();
    const criticResult = await this.critic.generateCommentary(analysisResult.analysis);
    const criticTime = Date.now() - criticStartTime;

    log.info(
      {
        sections: Object.keys(criticResult.commentary || {}).length,
        criticTime,
      },
      "Critique generation complete"
    );

    // Store combined result in S3 if too large
    const combinedResult = {
      ...analysisResult,
      critique: criticResult,
    };

    let outputResult = combinedResult;
    if (this.shouldUseS3(combinedResult)) {
      log.info("Combined result too large, storing in S3");
      outputResult = await this.storeInS3(
        combinedResult,
        `${executionId}/final-analysis-${Date.now()}.json`
      );
    }

    const costSoFar = (event.costSoFar || 0) + this.costTracker.getTotalCost();

    return {
      executionId, // Add at top level for Step Functions
      analysisResult: outputResult,
      criticResult,
      criticStats: {
        criticTime,
        modelUsed: criticResult.metadata.model,
      },
      metadata: {
        executionId,
        mode,
        totalPipelineTime: Date.now() - startTime,
      },
      costSoFar,
    };
  }
}

// Export handler for Lambda
const handler = new CriticHandler();
export const lambdaHandler = handler.handler.bind(handler);
