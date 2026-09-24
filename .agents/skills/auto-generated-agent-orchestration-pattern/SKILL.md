---
name: auto-generated-agent-orchestration-pattern
description: Agent orchestration pattern for multi-step email processing pipeline. Cost tracking, circuit breakers, graceful degradation, specialized agents. Triggers on "agent", "orchestrator", "pipeline", "multi-step processing", "specialized agents".
---

# Agent Orchestration Pattern

6-agent pipeline with cost tracking, circuit breakers, graceful degradation. Each agent specialized, all share single cost tracker.

## Agent Initialization with Cost Tracker

All agents initialized with shared CostTracker instance in orchestrator constructor:

```typescript
// From digest-processor.ts lines 81-90
this.costTracker = new CostTracker();

// Pass same instance to all agents
this.emailFetcher = new EmailFetcherAgent(this.costTracker);
this.classifier = new ClassifierAgent(this.costTracker);
this.contentExtractor = new ContentExtractorAgent(this.costTracker);
this.researcher = new ResearchAgent(this.costTracker);
this.analyst = new AnalysisAgent(this.costTracker);
this.critic = new CriticAgent(this.costTracker);
```

Agents accept cost tracker in constructor:

```typescript
// From AnalysisAgent.ts line 19
constructor(private costTracker: CostTracker) {
  this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
```

## Circuit Breaker Per Service

Named circuit breakers for each external service, initialized once:

```typescript
// From digest-processor.ts lines 96-99
this.gmailBreaker = EnhancedCircuitBreaker.getBreaker("gmail");
this.openaiBreaker = EnhancedCircuitBreaker.getBreaker("openai");
this.firecrawlBreaker = EnhancedCircuitBreaker.getBreaker("firecrawl");
this.braveBreaker = EnhancedCircuitBreaker.getBreaker("brave");
```

Wrap agent calls with circuit breaker execute:

```typescript
// From digest-processor.ts lines 131-138
const emailBatch = await this.gmailBreaker.execute(() =>
  this.emailFetcher.fetchEmails({
    mode: dateRange ? "historical" : "weekly",
    startDate: dateRange?.start,
    endDate: dateRange?.end,
    ...(maxEmails && { maxResults: maxEmails }),
  })
);
```

## Cost-Aware Pipeline Execution

Check cost limits between expensive steps:

```typescript
// From digest-processor.ts lines 196-199
if (this.costTracker.isApproachingLimit()) {
  this.logger.warn("Approaching cost limit, switching to simple digest");
  return this.processSimpleDigest(aiEmails);
}

// From digest-processor.ts lines 218-221
if (this.costTracker.shouldStop()) {
  this.logger.warn("Cost limit reached, generating digest with current data");
  return this.generateDigestFromResearch(researchedEmails, timings);
}
```

Cost tracking inside agents:

```typescript
// From AnalysisAgent.ts line 104
this.costTracker.recordApiCall("openai", "analyze", COST_LIMITS.OPENAI_GPT4O_MINI_COST);

// From ClassifierAgent.ts line 189
this.costTracker.recordApiCall("openai", "classify", COST_LIMITS.OPENAI_GPT4O_MINI_COST);
```

## Agent Stats Collection Pattern

Every agent implements getStats method:

```typescript
// From AnalysisAgent.ts lines 13-17
private stats = {
  analysisCompleted: 0,
  apiCallsMade: 0,
  errors: 0,
};

// From AnalysisAgent.ts lines 125-127
getStats() {
  return { ...this.stats };
}
```

Increment stats during operations:

```typescript
// From AnalysisAgent.ts line 34
this.stats.analysisCompleted++;

// From AnalysisAgent.ts line 36
this.stats.errors++;

// From AnalysisAgent.ts line 103
this.stats.apiCallsMade++;
```

Orchestrator aggregates all agent stats:

```typescript
// From digest-processor.ts lines 788-804
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
```

## Graceful Degradation Pattern

Fall back to simpler digest when cost limits hit:

```typescript
// From digest-processor.ts lines 588-616
private async processSimpleDigest(emails: any[]): Promise<DigestResult> {
  try {
    // Use simpler, cheaper summarizer instead of full pipeline
    const { summarize } = await import("../lib/summarizer");
    const summary = await summarize(emails);

    await sendDigest(summary, this.platform);

    // Archive emails
    const emailIds = emails.map((e) => e.id);
    await this.batchOperations.archiveEmails(emailIds);

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
```

Partial pipeline execution with research data only:

```typescript
// From digest-processor.ts lines 621-638
private async generateDigestFromResearch(
  researchedEmails: any[],
  timings: any
): Promise<DigestResult> {
  // Skip expensive analysis, use research data
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
```

## Batch Operations Delegation

Get batch operations from agent instead of creating in orchestrator:

```typescript
// From digest-processor.ts lines 92-93
// Initialize batchOperations from EmailFetcherAgent
this.batchOperations = this.emailFetcher.getBatchOperations();
```

Agent exposes batch operations:

```typescript
// From EmailFetcherAgent.ts lines 417-419
getBatchOperations(): GmailBatchOperations {
  return this.batchOps;
}
```

Use delegated batch operations:

```typescript
// From digest-processor.ts lines 279-280
const emailIds = aiEmails.map((e) => e.id);
await this.batchOperations.archiveEmails(emailIds);
```

## Pipeline Steps with Timing

Track timing for each agent step:

```typescript
// From digest-processor.ts lines 117-125
const timings = {
  fetchTime: 0,
  classificationTime: 0,
  extractionTime: 0,
  researchTime: 0,
  analysisTime: 0,
  commentaryTime: 0,
  totalTime: 0,
};

// From digest-processor.ts lines 130-139
const fetchStart = performance.now();
const emailBatch = await this.gmailBreaker.execute(() =>
  this.emailFetcher.fetchEmails({
    mode: dateRange ? "historical" : "weekly",
    startDate: dateRange?.start,
    endDate: dateRange?.end,
    ...(maxEmails && { maxResults: maxEmails }),
  })
);
timings.fetchTime = performance.now() - fetchStart;
```

Return timings in result:

```typescript
// From digest-processor.ts lines 293-300
return {
  success: true,
  emailsFound: emailBatch.metadata.length,
  emailsProcessed: aiEmails.length,
  message: `Successfully processed ${aiEmails.length} AI emails with deep analysis`,
  digest,
  costReport,
  processingStats: timings,
};
```

## Early Exit Patterns

Exit early if no content found:

```typescript
// From digest-processor.ts lines 159-168
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
```

Exit with auth error notification:

```typescript
// From digest-processor.ts lines 142-152
if (emailBatch.authError) {
  this.logger.error("Gmail authentication failed", emailBatch.authError);
  await sendReauthNotification(emailBatch.authError.message);
  return {
    success: false,
    emailsFound: 0,
    emailsProcessed: 0,
    message: "Gmail authentication failed - re-auth notification sent",
    error: emailBatch.authError.message,
  };
}
```

## Error Reporting with Circuit Breaker States

Include circuit breaker states in error reports:

```typescript
// From digest-processor.ts lines 752-776
private async sendErrorReport(error: any): Promise<void> {
  try {
    const errorDetails = `
Digest Processing Failed

Error: ${error instanceof Error ? error.message : "Unknown error"}
Time: ${formatISO(new Date())}
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
    // Log but don't throw - notifications shouldn't break main flow
    this.logger.warn("Failed to send error notification", notificationError);
  }
}
```

## Key Files

- `functions/core/digest-processor.ts` - Main orchestrator (595 lines)
- `functions/lib/agents/AnalysisAgent.ts` - Analysis agent pattern
- `functions/lib/agents/EmailFetcherAgent.ts` - Fetcher with batch operations
- `functions/lib/agents/ClassifierAgent.ts` - Classification with DynamoDB saves
- `functions/lib/cost-tracker.ts` - Shared cost tracking
- `functions/lib/circuit-breaker-enhanced.ts` - Named circuit breakers

## Avoid

- Creating separate cost trackers per agent (share one instance)
- Forgetting circuit breaker wrapping for external APIs
- Hard failures when cost limits hit (graceful degradation instead)
- Missing early exits (validate inputs before expensive operations)
- Swallowing errors in agent stats (increment error counters)
- Creating batch operations in orchestrator (delegate to agent)
