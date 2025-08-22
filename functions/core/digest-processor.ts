import { AnalysisAgent } from "../lib/agents/AnalysisAgent";
import { ClassifierAgent } from "../lib/agents/ClassifierAgent";
import { ContentExtractorAgent } from "../lib/agents/ContentExtractorAgent";
import { CriticAgent } from "../lib/agents/CriticAgent";
import { EmailFetcherAgent } from "../lib/agents/EmailFetcherAgent";
import { ResearchAgent } from "../lib/agents/ResearchAgent";
import { EnhancedCircuitBreaker } from "../lib/circuit-breaker-enhanced";
import { BATCH_LIMITS } from "../lib/constants";
import { CostTracker } from "../lib/cost-tracker";
import { sendDigest, sendErrorNotification } from "../lib/email";
import { GmailBatchOperations } from "../lib/gmail-batch-operations";
import type { ILogger } from "../lib/interfaces/logger";
import type { IStorageClient } from "../lib/interfaces/storage";
import { createLogger } from "../lib/logger";
import { getMetrics } from "../lib/metrics";
import { type DigestOutput, DigestOutputSchema } from "../lib/schemas/digest";
import type { Summary } from "../lib/types";

const log = createLogger("digest-processor");

export interface DigestProcessorOptions {
  storage: IStorageClient;
  logger?: ILogger;
  platform?: string;
}

export interface DigestResult {
  success: boolean;
  emailsFound: number;
  emailsProcessed: number;
  message: string;
  error?: string;
  digest?: Summary;
  costReport?: string;
  invocationId?: string;
  batches?: number;
  processingStats?: {
    fetchTime: number;
    classificationTime: number;
    extractionTime: number;
    researchTime: number;
    analysisTime: number;
    commentaryTime: number;
    totalTime: number;
  };
}

/**
 * Agent-based Digest Processor
 * Orchestrates multiple specialized agents for deep content analysis
 */
export class DigestProcessor {
  private storage: IStorageClient;
  private logger: ILogger;
  private platform?: string;

  // Agents
  private costTracker: CostTracker;
  private emailFetcher: EmailFetcherAgent;
  private classifier: ClassifierAgent;
  private contentExtractor: ContentExtractorAgent;
  private researcher: ResearchAgent;
  private analyst: AnalysisAgent;
  private critic: CriticAgent;
  private batchOperations: GmailBatchOperations;

  // Circuit breakers for external services
  private gmailBreaker: EnhancedCircuitBreaker;
  private openaiBreaker: EnhancedCircuitBreaker;
  private firecrawlBreaker: EnhancedCircuitBreaker;
  private braveBreaker: EnhancedCircuitBreaker;

  constructor(options: DigestProcessorOptions) {
    this.storage = options.storage;
    this.logger = options.logger || log;
    this.platform = options.platform;

    // Initialize cost tracker
    this.costTracker = new CostTracker();

    // Initialize agents
    this.emailFetcher = new EmailFetcherAgent(this.costTracker);
    this.classifier = new ClassifierAgent(this.costTracker);
    this.contentExtractor = new ContentExtractorAgent(this.costTracker);
    this.researcher = new ResearchAgent(this.costTracker);
    this.analyst = new AnalysisAgent(this.costTracker);
    this.critic = new CriticAgent(this.costTracker);
    
    // Initialize batchOperations from EmailFetcherAgent
    this.batchOperations = this.emailFetcher.getBatchOperations();

    // Initialize circuit breakers
    this.gmailBreaker = EnhancedCircuitBreaker.getBreaker("gmail");
    this.openaiBreaker = EnhancedCircuitBreaker.getBreaker("openai");
    this.firecrawlBreaker = EnhancedCircuitBreaker.getBreaker("firecrawl");
    this.braveBreaker = EnhancedCircuitBreaker.getBreaker("brave");
  }

  /**
   * Process weekly digest with full agent pipeline
   */
  async processWeeklyDigest(): Promise<DigestResult> {
    this.logger.info("Starting weekly digest processing");

    const startTime = Date.now();
    const timings = {
      fetchTime: 0,
      classificationTime: 0,
      extractionTime: 0,
      researchTime: 0,
      analysisTime: 0,
      commentaryTime: 0,
      totalTime: 0,
    };

    try {
      // Step 1: Fetch emails with metadata-first approach
      this.logger.info("Step 1: Fetching emails");
      const fetchStart = Date.now();
      const emailBatch = await this.gmailBreaker.execute(() =>
        this.emailFetcher.fetchEmails({ mode: "weekly" })
      );
      timings.fetchTime = Date.now() - fetchStart;

      this.logger.info(
        `Fetched ${emailBatch.metadata.length} emails, ${emailBatch.stats.totalFetched} need processing`
      );

      // Early exit if no emails
      if (!emailBatch.stats.totalFetched || emailBatch.stats.totalFetched === 0) {
        this.logger.info("No AI-related emails found, not sending digest");
        return {
          success: true,
          emailsFound: emailBatch.metadata.length,
          emailsProcessed: 0,
          message: "No AI-related emails found to process",
          costReport: this.costTracker.generateReport(),
        };
      }

      // Step 2: Classify unknown senders
      this.logger.info("Step 2: Classifying unknown senders");
      const classifyStart = Date.now();
      const classifications = await this.openaiBreaker.execute(() =>
        this.classifier.classifyEmails(emailBatch)
      );
      timings.classificationTime = Date.now() - classifyStart;

      // Filter to only AI emails
      const aiEmails = emailBatch.fullEmails.filter((email) => {
        const classification = classifications.get(email.id);
        return !classification || classification.classification === "AI";
      });

      this.logger.info(`${aiEmails.length} emails classified as AI-related`);

      if (aiEmails.length === 0) {
        return {
          success: true,
          emailsFound: emailBatch.metadata.length,
          emailsProcessed: 0,
          message: "No AI-related emails after classification",
        };
      }

      // Check cost before continuing
      if (this.costTracker.isApproachingLimit()) {
        this.logger.warn("Approaching cost limit, switching to simple digest");
        return this.processSimpleDigest(aiEmails);
      }

      // Step 3: Extract content with Firecrawl
      this.logger.info("Step 3: Extracting article content");
      const extractStart = Date.now();
      const enrichedEmails = await this.firecrawlBreaker.execute(() =>
        this.contentExtractor.extractArticles(aiEmails)
      );
      timings.extractionTime = Date.now() - extractStart;

      // Step 4: Research additional context
      this.logger.info("Step 4: Researching additional context");
      const researchStart = Date.now();
      const researchedEmails = await this.braveBreaker.execute(() =>
        this.researcher.enrichWithResearch(enrichedEmails)
      );
      timings.researchTime = Date.now() - researchStart;

      // Check cost again
      if (this.costTracker.shouldStop()) {
        this.logger.warn("Cost limit reached, generating digest with current data");
        return this.generateDigestFromResearch(researchedEmails, timings);
      }

      // Step 5: Deep analysis
      this.logger.info("Step 5: Performing deep analysis");
      const analysisStart = Date.now();
      const analysisResult = await this.openaiBreaker.execute(() =>
        this.analyst.analyzeContent(researchedEmails)
      );
      timings.analysisTime = Date.now() - analysisStart;

      // Step 6: Generate commentary
      this.logger.info("Step 6: Generating opinionated commentary");
      const commentaryStart = Date.now();
      const criticResult = await this.openaiBreaker.execute(() =>
        this.critic.generateCommentary(analysisResult)
      );
      timings.commentaryTime = Date.now() - commentaryStart;

      // Step 7: Build and send digest
      this.logger.info("Step 7: Building and sending digest");
      const digest = this.buildDigest(analysisResult, criticResult);

      // Only send digest if there's actual content
      if (!digest) {
        this.logger.info("No content to send in digest, skipping email");
        return {
          success: true,
          emailsFound: emailBatch.metadata.length,
          emailsProcessed: aiEmails.length,
          message: "Processed emails but no meaningful analysis generated",
          costReport: this.costTracker.generateReport(),
        };
      }

      // Additional validation for digest content
      const digestOutput = digest.digest as DigestOutput;
      const hasValidContent =
        (digestOutput.whatHappened && digestOutput.whatHappened.length > 0) ||
        (digestOutput.takeaways && digestOutput.takeaways.length > 0) ||
        (digestOutput.productPlays && digestOutput.productPlays.length > 0) ||
        (digestOutput.tools && digestOutput.tools.length > 0);

      if (!hasValidContent) {
        this.logger.info("Digest has no valid content sections, skipping email");
        return {
          success: true,
          emailsFound: emailBatch.metadata.length,
          emailsProcessed: aiEmails.length,
          message: "Processed emails but digest had no valid content",
          costReport: this.costTracker.generateReport(),
        };
      }

      await sendDigest(digest, this.platform);

      // Step 8: Archive processed emails
      this.logger.info("Step 8: Archiving processed emails");
      const emailIds = aiEmails.map((e) => e.id);
      await this.batchOperations.batchMarkReadAndArchive(emailIds);

      // Mark emails as processed in storage
      await this.storage.markMultipleProcessed(
        aiEmails.map((e) => ({ id: e.id, subject: e.subject }))
      );

      timings.totalTime = Date.now() - startTime;

      // Generate cost report
      const costReport = this.costTracker.generateReport();
      this.logger.info("Cost Report:\n" + costReport);

      return {
        success: true,
        emailsFound: emailBatch.metadata.length,
        emailsProcessed: aiEmails.length,
        message: `Successfully processed ${aiEmails.length} AI emails with deep analysis`,
        digest,
        costReport,
        processingStats: timings,
      };
    } catch (error) {
      this.logger.error("Digest processing failed", error);

      // Send error notification
      await this.sendErrorReport(error);

      return {
        success: false,
        emailsFound: 0,
        emailsProcessed: 0,
        message: "Digest processing failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process cleanup digest (all unarchived emails)
   */
  async processCleanupDigest(batchSize = 50): Promise<DigestResult> {
    this.logger.info(`Starting cleanup digest processing with batch size ${batchSize}`);

    let processedCount = 0;
    let batchCount = 0;

    try {
      // Fetch ALL unarchived emails
      const emailBatch = await this.gmailBreaker.execute(() =>
        this.emailFetcher.fetchEmails({ mode: "cleanup", batchSize, cleanup: true })
      );

      const aiEmails = emailBatch.fullEmails;

      if (aiEmails.length === 0) {
        return {
          success: true,
          emailsFound: emailBatch.metadata.length,
          emailsProcessed: 0,
          message: "No unprocessed AI emails found",
        };
      }

      // Process in batches to avoid overwhelming the system
      const batchSize = BATCH_LIMITS.CLEANUP_BATCH_SIZE;

      for (let i = 0; i < aiEmails.length; i += batchSize) {
        batchCount++;
        const batch = aiEmails.slice(i, i + batchSize);

        this.logger.info(`Processing cleanup batch ${batchCount}: ${batch.length} emails`);

        // Process batch with simplified pipeline (no deep analysis)
        const digest = await this.processSimpleDigest(batch);

        if (digest.success) {
          processedCount += batch.length;
        }

        // Delay between batches
        if (i + batchSize < aiEmails.length) {
          await this.sleep(BATCH_LIMITS.BATCH_DELAY_MS);
        }

        // Check cost limits
        if (this.costTracker.shouldStop()) {
          this.logger.warn("Cost limit reached during cleanup");
          break;
        }
      }

      return {
        success: true,
        emailsFound: emailBatch.metadata.length,
        emailsProcessed: processedCount,
        message: `Cleanup complete: processed ${processedCount} emails in ${batchCount} batches`,
      };
    } catch (error) {
      this.logger.error("Cleanup digest failed", error);

      return {
        success: false,
        emailsFound: 0,
        emailsProcessed: processedCount,
        message: `Cleanup failed after processing ${processedCount} emails`,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process historical digest for a specific date range
   */
  async processHistoricalDigest(
    startDate: string,
    endDate: string,
    batchSize?: number
  ): Promise<DigestResult> {
    try {
      this.logger.info(`Processing historical digest from ${startDate} to ${endDate}`);
      
      // Reset cost tracker for this run
      this.costTracker.reset();
      const timings: any = { startTime: Date.now() };

      // Step 1: Fetch emails from the date range
      this.logger.info("Step 1: Fetching historical emails");
      const fetchStart = Date.now();
      const emailBatch = await this.gmailBreaker.execute(() =>
        this.emailFetcher.fetchEmails({
          mode: "historical",
          startDate,
          endDate,
          batchSize: batchSize || 500,
        })
      );
      timings.fetchTime = Date.now() - fetchStart;

      const emails = emailBatch.fullEmails;
      this.logger.info(`Found ${emails.length} emails in historical date range`);

      if (emails.length === 0) {
        return {
          success: true,
          emailsFound: 0,
          emailsProcessed: 0,
          message: `No emails found between ${startDate} and ${endDate}`,
        };
      }

      // Check for cost limit
      if (this.costTracker.shouldStop()) {
        this.logger.warn("Cost limit reached before processing");
        return {
          success: false,
          emailsFound: emails.length,
          emailsProcessed: 0,
          message: "Cost limit reached",
        };
      }

      // Step 2: Classify unknown senders
      this.logger.info("Step 2: Classifying senders");
      const classifyStart = Date.now();
      const classificationResults = await this.openaiBreaker.execute(() =>
        this.classifier.classifyEmails(emailBatch, false)
      );
      timings.classificationTime = Date.now() - classifyStart;

      // Filter for AI emails based on classification
      const aiEmails = emails.filter((email) => {
        const senderEmail = this.extractEmailAddress(email.sender);
        const classification = classificationResults.get(senderEmail || "");
        return classification?.classification === "AI" || 
               emailBatch.aiEmailIds.includes(email.id);
      });
      this.logger.info(`Classified ${aiEmails.length} AI-related emails`);

      if (aiEmails.length === 0) {
        return {
          success: true,
          emailsFound: emails.length,
          emailsProcessed: 0,
          message: "No AI-related emails in the historical period",
        };
      }

      // Continue with the standard pipeline for AI emails
      // Step 3: Extract content
      this.logger.info("Step 3: Extracting article content");
      const extractStart = Date.now();
      const enrichedEmails = await this.firecrawlBreaker.execute(() =>
        this.contentExtractor.extractArticles(aiEmails)
      );
      timings.extractionTime = Date.now() - extractStart;

      // Step 4: Research
      this.logger.info("Step 4: Researching additional context");
      const researchStart = Date.now();
      const researchedEmails = await this.braveBreaker.execute(() =>
        this.researcher.enrichWithResearch(enrichedEmails)
      );
      timings.researchTime = Date.now() - researchStart;

      // Step 5: Analysis
      this.logger.info("Step 5: Performing deep analysis");
      const analysisStart = Date.now();
      const analysisResult = await this.openaiBreaker.execute(() =>
        this.analyst.analyzeContent(researchedEmails)
      );
      timings.analysisTime = Date.now() - analysisStart;

      // Step 6: Commentary
      this.logger.info("Step 6: Generating commentary");
      const commentaryStart = Date.now();
      const criticResult = await this.openaiBreaker.execute(() =>
        this.critic.generateCommentary(analysisResult)
      );
      timings.commentaryTime = Date.now() - commentaryStart;

      // Step 7: Build and send digest
      this.logger.info("Step 7: Building and sending historical digest");
      const digest = this.buildDigest(analysisResult, criticResult);
      
      if (digest) {
        // Add historical period info to the digest
        digest.period = `${startDate} to ${endDate}`;
        await sendDigest(digest, this.platform);
      }

      // Don't archive historical emails - they might already be archived
      this.logger.info("Skipping email archival for historical digest");

      const totalTime = Date.now() - timings.startTime;
      this.logger.info(`Historical digest completed in ${totalTime}ms`);

      return {
        success: true,
        emailsFound: emails.length,
        emailsProcessed: aiEmails.length,
        message: `Historical digest sent for ${startDate} to ${endDate}`,
        digest,
        processingStats: {
          ...timings,
          totalTime,
          emailsAnalyzed: aiEmails.length,
          dateRange: { start: startDate, end: endDate },
        },
        costReport: this.costTracker.getCostBreakdown(),
      };
    } catch (error) {
      this.logger.error("Historical digest processing failed", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        emailsFound: 0,
        emailsProcessed: 0,
        message: `Historical digest failed: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Helper: Extract email address from sender string
   */
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
   * Process simple digest without deep analysis (fallback/cost-saving)
   */
  private async processSimpleDigest(emails: any[]): Promise<DigestResult> {
    try {
      // Use the existing summarizer (simpler, cheaper)
      const { summarize } = await import("../lib/summarizer");
      const summary = await summarize(emails);

      await sendDigest(summary, this.platform);

      // Archive emails
      const emailIds = emails.map((e) => e.id);
      await this.batchOperations.batchMarkReadAndArchive(emailIds);

      return {
        success: true,
        emailsFound: emails.length,
        emailsProcessed: emails.length,
        message: "Simple digest sent (cost-optimized)",
        digest: summary,
      };
    } catch (error) {
      return {
        success: false,
        emailsFound: emails.length,
        emailsProcessed: 0,
        message: "Simple digest failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Generate digest from research data (partial pipeline)
   */
  private async generateDigestFromResearch(
    researchedEmails: any[],
    timings: any
  ): Promise<DigestResult> {
    // Build a simplified digest from research data
    const digest = this.buildSimpleDigestFromResearch(researchedEmails);

    await sendDigest(digest, this.platform);

    return {
      success: true,
      emailsFound: researchedEmails.length,
      emailsProcessed: researchedEmails.length,
      message: "Digest sent with research data (no deep analysis due to cost)",
      digest,
      processingStats: timings,
    };
  }

  /**
   * Build final digest from analysis and commentary
   */
  private buildDigest(analysisResult: any, criticResult: any): Summary | null {
    // Validate input
    if (!analysisResult?.analysis || !criticResult?.commentary) {
      this.logger.warn("Missing analysis or commentary data");
      return null;
    }

    const analysis = analysisResult.analysis;
    const commentary = criticResult.commentary;

    // Check if we have any meaningful content
    const hasContent =
      (analysis.keyDevelopments && analysis.keyDevelopments.length > 0) ||
      (commentary.whatToActuallyDo && commentary.whatToActuallyDo.length > 0) ||
      (analysis.businessOpportunities && analysis.businessOpportunities.length > 0);

    if (!hasContent) {
      this.logger.warn("No meaningful content in analysis");
      return null;
    }

    // Convert to digest format
    const digestOutput: DigestOutput = {
      headline: commentary.sharpestObservation.observation || "AI Digest This Week",
      summary: analysis.keyDevelopments[0]?.significance || "Weekly AI developments",

      whatHappened: analysis.keyDevelopments.map((dev: any) => ({
        title: dev.title,
        source: "Analysis",
        description: dev.significance,
        category: dev.category === "breakthrough" ? "research" : "industry",
      })),

      takeaways: commentary.whatToActuallyDo.map((action: any) => ({
        category: action.effort === "trivial" ? "technical" : "business",
        title: action.action,
        description: action.why,
        actionable: true,
      })),

      rolePlays: [], // Could be populated from analysis

      productPlays: analysis.businessOpportunities.map((opp: any) => ({
        appName: "Your App",
        feature: opp.opportunity,
        description: opp.timing,
        effort: opp.estimatedEffort === "days" ? "quick-win" : "1-2-days",
        impact: "high",
      })),

      tools: analysis.technicalInsights.map((insight: any) => ({
        name: insight.concept,
        category: "developer-tool",
        description: insight.explanation,
        useCase: insight.practicalApplication,
      })),

      shortMessage: commentary.sharpestObservation.whatToDo,

      keyThemes: analysis.patterns.map((p: any) => p.pattern),

      competitiveIntel: commentary.competitiveIntel,
    };

    return {
      digest: digestOutput,
      message: digestOutput.shortMessage,
      items: [],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build simple digest from research data
   */
  private buildSimpleDigestFromResearch(researchedEmails: any[]): Summary {
    // Extract key information from researched emails
    const items = researchedEmails.flatMap((email) =>
      email.articles.filter((a: any) => a.extractedSuccessfully)
    );

    const digestOutput: DigestOutput = {
      headline: "AI Digest - Research Summary",
      summary: `Analyzed ${items.length} articles from ${researchedEmails.length} emails`,
      whatHappened: items.slice(0, 10).map((item: any) => ({
        title: item.title || item.url,
        source: new URL(item.url).hostname,
        description: item.desc || item.snippet || "",
      })),
      takeaways: [],
      rolePlays: [],
      productPlays: [],
      tools: [],
      shortMessage: `${items.length} AI articles analyzed this week`,
      keyThemes: [],
      competitiveIntel: [],
    };

    return {
      digest: digestOutput,
      message: digestOutput.shortMessage,
      items: [],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Send error report (safely, without breaking main flow)
   */
  private async sendErrorReport(error: any): Promise<void> {
    try {
      const errorDetails = `
Digest Processing Failed

Error: ${error instanceof Error ? error.message : "Unknown error"}
Time: ${new Date().toISOString()}
Platform: ${this.platform}

Cost Report:
${this.costTracker.generateReport()}

Circuit Breakers:
Gmail: ${this.gmailBreaker.getStats().state}
OpenAI: ${this.openaiBreaker.getStats().state}
Firecrawl: ${this.firecrawlBreaker.getStats().state}
Brave: ${this.braveBreaker.getStats().state}
      `.trim();

      await sendErrorNotification(new Error(errorDetails));
    } catch (notificationError) {
      // Log the error but don't throw - notifications shouldn't break the main flow
      this.logger.warn("Failed to send error notification", notificationError);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get processor statistics
   */
  getStats(): any {
    return {
      costReport: this.costTracker.generateReport(),
      circuitBreakers: {
        gmail: this.gmailBreaker.getStats(),
        openai: this.openaiBreaker.getStats(),
        firecrawl: this.firecrawlBreaker.getStats(),
        brave: this.braveBreaker.getStats(),
      },
      agents: {
        extractor: this.contentExtractor.getStats(),
        researcher: this.researcher.getStats(),
        analyst: this.analyst.getStats(),
        critic: this.critic.getStats(),
      },
    };
  }
}
