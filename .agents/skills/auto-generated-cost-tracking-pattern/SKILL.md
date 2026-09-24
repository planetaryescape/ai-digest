---
name: auto-generated-cost-tracking-pattern
description: Cost control patterns preventing bankruptcy in this indie SaaS. Hard $1/run limit, service-specific cost calculation, graceful degradation. Triggers on "cost", "budget", "api calls", "cost tracking", "spending limit".
---

# Cost Tracking Patterns

Hard $1/run limit prevents runaway API costs. Non-obvious patterns: 80% threshold warnings, shouldStop vs isApproachingLimit, service-specific cost calculation.

## Initialization

Cost tracker initialized in constructor, injected into all agents:

```typescript
// From digest-processor.ts line 82
this.costTracker = new CostTracker();

// Inject into every agent
this.emailFetcher = new EmailFetcherAgent(this.costTracker);
this.classifier = new ClassifierAgent(this.costTracker);
this.contentExtractor = new ContentExtractorAgent(this.costTracker);
this.researcher = new ResearchAgent(this.costTracker);
this.analyst = new AnalysisAgent(this.costTracker);
this.critic = new CriticAgent(this.costTracker);
```

Single shared instance across entire pipeline.

## Recording API Calls

Two patterns for recording costs:

```typescript
// Pattern 1: Auto-calculate from service/operation
costTracker.recordApiCall("openai", "classify");
costTracker.recordApiCall("firecrawl", "extract");

// Pattern 2: Explicit cost (when known)
costTracker.recordApiCall("openai", "analyze", 0.15);
```

Service-specific auto-calculation (cost-tracker.ts line 58-79):

```typescript
private calculateCost(service: string, operation: string): number {
  switch (service) {
    case "openai":
      if (operation === "classify" || operation === "analyze" || operation === "critique") {
        return COST_LIMITS.OPENAI_GPT4O_MINI_COST; // $0.01
      }
      return COST_LIMITS.OPENAI_GPT5_COST; // $0.1

    case "firecrawl":
      return COST_LIMITS.FIRECRAWL_COST_PER_URL; // $0.001

    case "brave":
      return COST_LIMITS.BRAVE_SEARCH_COST; // $0.001

    case "gmail":
      return 0; // Gmail API is free

    default:
      return 0;
  }
}
```

## Cost Constants

Service costs in constants.ts:

```typescript
export const COST_LIMITS = {
  MAX_COST_PER_RUN: 1.0,
  MAX_OPENAI_CALLS_PER_RUN: 50,
  MAX_FIRECRAWL_CALLS_PER_RUN: 100,
  MAX_BRAVE_SEARCHES_PER_RUN: 50,
  OPENAI_GPT5_COST: 0.1,
  OPENAI_GPT4O_MINI_COST: 0.01,
  FIRECRAWL_COST_PER_URL: 0.001,
  BRAVE_SEARCH_COST: 0.001,
} as const;
```

Adjust MAX_COST_PER_RUN via env var if needed.

## Budget Checking Patterns

Three distinct methods with different purposes:

### isApproachingLimit() - Early Warning

Check at 80% threshold for graceful degradation:

```typescript
// digest-processor.ts line 196
if (this.costTracker.isApproachingLimit()) {
  this.logger.warn("Approaching cost limit, switching to simple digest");
  return this.processSimpleDigest(aiEmails);
}
```

Implementation (cost-tracker.ts line 131):

```typescript
isApproachingLimit(): boolean {
  return this.totalCost > COST_LIMITS.MAX_COST_PER_RUN * 0.8;
}
```

### shouldStop() - Hard Stop

Check for exact limit hit, stop processing:

```typescript
// digest-processor.ts line 218
if (this.costTracker.shouldStop()) {
  this.logger.warn("Cost limit reached, generating digest with current data");
  return this.generateDigestFromResearch(researchedEmails, timings);
}

// digest-processor.ts line 379 (cleanup mode)
if (this.costTracker.shouldStop()) {
  this.logger.warn("Cost limit reached during cleanup");
  break;
}
```

Implementation (cost-tracker.ts line 144):

```typescript
shouldStop(): boolean {
  return this.totalCost >= COST_LIMITS.MAX_COST_PER_RUN;
}
```

### canAfford() - Pre-operation Check

Check before expensive operation:

```typescript
canAfford(estimatedCost: number): boolean {
  return this.totalCost + estimatedCost <= COST_LIMITS.MAX_COST_PER_RUN;
}
```

Use before batch operations to avoid partial work.

## Automatic Warning Logs

Cost tracker logs warning at 80% automatically during recordApiCall:

```typescript
// cost-tracker.ts line 50
if (this.totalCost > COST_LIMITS.MAX_COST_PER_RUN * 0.8) {
  log.warn(
    { totalCost: this.totalCost, limit: COST_LIMITS.MAX_COST_PER_RUN },
    "Approaching cost limit"
  );
}
```

No manual warning needed.

## Cost Reports

Two formats: string report and structured breakdown.

String report for logs:

```typescript
// cost-tracker.ts line 135
generateReport(): string {
  const stats = this.getStats();
  return `Cost Report:
- Total Cost: $${stats.totalCost.toFixed(4)}
- Remaining Budget: $${stats.remainingBudget.toFixed(4)}
- API Calls: ${stats.apiCalls}
- Cost by Service: ${JSON.stringify(stats.costByService, null, 2)}`;
}

// Usage in digest-processor.ts line 291
const costReport = this.costTracker.generateReport();
this.logger.info(`Cost Report:\n${costReport}`);
```

Structured breakdown for response:

```typescript
// cost-tracker.ts line 148
getCostBreakdown(): Record<string, any> {
  return {
    total: this.totalCost,
    byService: this.getCostByService(),
    apiCalls: Object.fromEntries(this.apiCallCounts),
  };
}

// digest-processor.ts line 555
costReport: this.costTracker.getCostBreakdown(),
```

## Graceful Degradation

Three levels of processing based on budget:

```typescript
// Level 1: Full pipeline (if budget allows)
// - Classification, extraction, research, analysis, commentary

// Level 2: Simple digest (at 80% threshold)
if (this.costTracker.isApproachingLimit()) {
  return this.processSimpleDigest(aiEmails);
}

// Level 3: Research-only digest (at 100% limit)
if (this.costTracker.shouldStop()) {
  return this.generateDigestFromResearch(researchedEmails, timings);
}
```

processSimpleDigest uses cheaper summarizer:

```typescript
// digest-processor.ts line 588
private async processSimpleDigest(emails: any[]): Promise<DigestResult> {
  const { summarize } = await import("../lib/summarizer");
  const summary = await summarize(emails);
  await sendDigest(summary, this.platform);
  // ... archive
}
```

## Error Reports Include Costs

Cost report included in error notifications:

```typescript
// digest-processor.ts line 754
private async sendErrorReport(error: any): Promise<void> {
  const errorDetails = `
Digest Processing Failed

Error: ${error.message}
Platform: ${this.platform}

Cost Report:
${this.costTracker.generateReport()}
  `.trim();

  await sendErrorNotification(new Error(errorDetails));
}
```

## Stats for Monitoring

Full stats with cost breakdown:

```typescript
// digest-processor.ts line 788
getStats(): any {
  return {
    costReport: this.costTracker.generateReport(),
    circuitBreakers: { /* ... */ },
    agents: { /* ... */ },
  };
}
```

## Key Files

- `functions/lib/cost-tracker.ts` - CostTracker class
- `functions/lib/constants.ts` - COST_LIMITS configuration
- `functions/core/digest-processor.ts` - Usage patterns

## Anti-Patterns

Don't check budget after expensive operations:

```typescript
// Wrong - already spent money
const result = await expensiveApiCall();
if (this.costTracker.shouldStop()) { /* too late */ }

// Right - check before
if (!this.costTracker.canAfford(estimatedCost)) {
  return fallback();
}
await expensiveApiCall();
```

Don't use isWithinBudget() for flow control - too vague:

```typescript
// Wrong - unclear intent
if (!this.costTracker.isWithinBudget()) { /* do what? */ }

// Right - specific action
if (this.costTracker.isApproachingLimit()) {
  return this.processSimpleDigest(emails);
}
if (this.costTracker.shouldStop()) {
  break;
}
```

Don't record costs manually in agents - let CostTracker calculate:

```typescript
// Wrong - duplicates calculation logic
const cost = service === "openai" ? 0.1 : 0.001;
costTracker.recordApiCall(service, operation, cost);

// Right - let it auto-calculate
costTracker.recordApiCall(service, operation);
```
