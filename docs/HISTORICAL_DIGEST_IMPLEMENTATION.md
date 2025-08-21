# Historical Digest Mode Implementation Guide

## Executive Summary

### Feature Overview

The **Historical Digest Mode** is a new feature for the AI Digest system that enables users to generate digest reports from any specified historical time period, including archived emails. This complements the existing weekly and cleanup modes by providing flexible, on-demand digest generation for past periods.

### Business Value & Use Cases

- **Vacation Catch-up**: Generate digests for periods when you were away
- **Year-end Summaries**: Create annual or quarterly AI news summaries
- **Trend Analysis**: Research AI developments during specific time periods
- **Missed Content Recovery**: Retrieve digests for weeks when the system didn't run
- **Historical Research**: Analyze past AI news for patterns and insights

### Integration with Existing Modes

| Mode           | Query Pattern                    | Scope                         | Use Case                       |
| -------------- | -------------------------------- | ----------------------------- | ------------------------------ |
| weekly         | `in:inbox newer_than:7d`         | Last 7 days, inbox only       | Regular weekly digest          |
| cleanup        | `in:inbox`                       | All unarchived emails         | One-time inbox cleanup         |
| **historical** | `after:YYYY/M/D before:YYYY/M/D` | Custom date range, all emails | eOn-demand historical analysis |

## System Architecture Context

### Current Architecture Overview

The AI Digest system uses AWS Step Functions to orchestrate a pipeline of specialized agents that process emails through multiple stages:

```
Entry Points (Lambda/API Gateway)
    ↓
Step Functions Pipeline
    ↓
1. EmailFetcherAgent → Fetch emails based on mode
2. ClassifierAgent → Classify senders as AI/non-AI
3. ContentExtractorAgent → Extract article content (parallel)
4. ResearchAgent → Web research for context (parallel)
5. AnalysisAgent → Generate summaries with GPT-4o
6. CriticAgent → Add opinionated commentary
7. DigestSender → Format and send email
```

### Key Components

#### Step Functions Pipeline

- **Location**: `terraform/aws/stepfunctions/ai-digest-pipeline.asl.json`
- **Stages**: Sequential and parallel processing stages
- **Input**: Accepts mode and parameters that flow through all stages
- **Orchestration**: Handles retries, error handling, and state management

#### EmailFetcherAgent

- **Location**: `functions/lib/agents/EmailFetcherAgent.ts`
- **Purpose**: Efficiently fetch emails using metadata-first approach
- **Optimization**: 70% reduction in Gmail API calls
- **Current Modes**:
  - Weekly: `getMessageIds("weekly")` → `"in:inbox newer_than:7d"`
  - Cleanup: `getMessageIds("cleanup")` → `"in:inbox"`

#### Gmail Integration

- **Location**: `functions/lib/gmail.ts`
- **Authentication**: OAuth2 with refresh tokens
- **Query Construction**: `listMessages(query, maxResults)`
- **Batch Processing**: Handles up to 100 messages per batch

#### Sender Classification

- **Storage**: DynamoDB tables (ai-digest-known-ai-senders, ai-digest-known-non-ai-senders)
- **Caching**: Reduces re-classification by 80%+
- **Confidence Decay**: Decreases over time to handle sender evolution

#### Cost Management

- **Tracking**: Real-time cost tracking with hard limits
- **Default Limit**: $1 per run (configurable)
- **Circuit Breakers**: Prevent cascade failures and cost overruns

### Infrastructure Components

- **Lambda Functions**: Individual handlers for each Step Functions stage
- **EventBridge**: Triggers weekly scheduled runs
- **DynamoDB**: Stores sender classifications and processed email IDs
- **S3**: Stores large payloads when exceeding Lambda limits
- **CloudWatch**: Monitoring, logging, and alerting

## Technical Specification

### Input Parameters Structure

```typescript
interface HistoricalDigestRequest {
  mode: "historical"; // New mode identifier
  startDate: string; // ISO format: "2024-12-01"
  endDate: string; // ISO format: "2024-12-31"
  includeArchived?: boolean; // Default: true for historical
  batchSize?: number; // Optional limit (default: 200)
  maxEmails?: number; // Maximum emails to process
}
```

### Gmail Query Construction

The historical mode constructs Gmail queries using date ranges instead of relative time:

```typescript
// Current Implementation (weekly mode)
const query = "in:inbox newer_than:7d";

// Historical Mode Implementation
const query = `after:${formatGmailDate(startDate)} before:${formatGmailDate(endDate)}`;
// Example: "after:2024/12/1 before:2024/12/31"

// Note: No "in:inbox" restriction to include archived emails
```

### Date Format Conversion

Gmail requires dates in `YYYY/M/D` format:

```typescript
function formatGmailDate(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // No leading zero
  const day = date.getDate(); // No leading zero
  return `${year}/${month}/${day}`;
}
```

### Validation Rules

1. **Date Format**: Must be valid ISO date strings
2. **Date Range**: startDate must be before endDate
3. **Maximum Range**: Limit to 90 days to control costs
4. **Minimum Date**: Cannot query before Gmail account creation
5. **Future Dates**: endDate cannot be in the future

## Implementation Steps

### Step 1: Update Type Definitions

**File**: `functions/handlers/unified/types.ts`

```typescript
export interface UnifiedRequest {
  type: "http" | "timer" | "event";
  method?: string;
  path?: string;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  source?: string;
  cleanup?: boolean;
  batchSize?: number;
  invocationId: string;
  timestamp: Date;

  // Add historical mode fields
  mode?: "weekly" | "cleanup" | "historical";
  startDate?: string; // ISO format date
  endDate?: string; // ISO format date
  includeArchived?: boolean;
}
```

### Step 2: Modify EmailFetcherAgent

**File**: `functions/lib/agents/EmailFetcherAgent.ts`

#### Update the fetchEmails options interface

```typescript
async fetchEmails(
  options: {
    mode?: "weekly" | "cleanup" | "historical";  // Add historical
    batchSize?: number;
    cleanup?: boolean;
    executionId?: string;
    startDate?: string;    // Add date range support
    endDate?: string;      // Add date range support
  } = {}
): Promise<EmailBatch> {
  const mode = options.cleanup ? "cleanup" : options.mode || "weekly";

  // Validate historical mode parameters
  if (mode === "historical") {
    if (!options.startDate || !options.endDate) {
      throw new Error("Historical mode requires startDate and endDate");
    }
    this.validateDateRange(options.startDate, options.endDate);
  }

  // ... rest of implementation
}
```

#### Update getMessageIds method

```typescript
private async getMessageIds(
  mode: "weekly" | "cleanup" | "historical",
  startDate?: string,
  endDate?: string
): Promise<string[]> {
  let query: string;
  let maxResults: number;

  switch (mode) {
    case "weekly":
      query = "in:inbox newer_than:7d";
      maxResults = 500;
      break;

    case "cleanup":
      query = "in:inbox";
      maxResults = 2000;
      break;

    case "historical":
      if (!startDate || !endDate) {
        throw new Error("Historical mode requires date range");
      }
      // No inbox restriction to include archived emails
      query = `after:${this.formatGmailDate(startDate)} before:${this.formatGmailDate(endDate)}`;
      maxResults = 1000; // Adjust based on expected volume
      break;

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }

  try {
    const messageIds = await gmailClient.listMessages(query, maxResults);
    getMetrics().gauge("emails.listed", messageIds.length, { mode });
    return messageIds;
  } catch (error) {
    log.error({ error, mode }, "Failed to list messages");
    throw error;
  }
}
```

#### Add helper methods

```typescript
private formatGmailDate(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}/${month}/${day}`;
}

private validateDateRange(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date format. Use ISO format (YYYY-MM-DD)");
  }

  if (start >= end) {
    throw new Error("startDate must be before endDate");
  }

  if (end > now) {
    throw new Error("endDate cannot be in the future");
  }

  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 90) {
    throw new Error("Date range cannot exceed 90 days");
  }
}
```

### Step 3: Update Step Functions Email Fetcher Handler

**File**: `functions/handlers/stepfunctions/email-fetcher.ts`

```typescript
async process(event: any, context: Context): Promise<any> {
  const input = event.input || event;
  const mode = input.mode || "weekly";
  const batchSize = input.batchSize;
  const cleanup = input.cleanup;
  const executionId = event.executionId;
  const startTime = event.startTime || new Date().toISOString();

  // Add historical mode parameters
  const startDate = input.startDate;
  const endDate = input.endDate;

  log.info({
    mode,
    batchSize,
    cleanup,
    executionId,
    startDate,
    endDate
  }, "Starting email fetch");

  // Fetch emails based on mode and parameters
  const fetchResult = await this.emailFetcher.fetchEmails({
    mode,
    batchSize,
    cleanup,
    executionId,
    startDate,    // Pass date range
    endDate,      // Pass date range
  });

  // ... rest of implementation
}
```

### Step 4: Modify Lambda Entry Points

**File**: `functions/handlers/aws/run-now.ts`

```typescript
async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const functionName = process.env.WEEKLY_DIGEST_FUNCTION_NAME;

  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};

    // Check for different modes
    const cleanup =
      event.queryStringParameters?.cleanup === "true" || body.cleanup === true;

    const mode = body.mode || (cleanup ? "cleanup" : "weekly");

    // Historical mode parameters
    const startDate = body.startDate;
    const endDate = body.endDate;

    // Validate historical mode
    if (mode === "historical") {
      if (!startDate || !endDate) {
        return {
          statusCode: 400,
          headers: {
            /* CORS headers */
          },
          body: JSON.stringify({
            success: false,
            error: "Historical mode requires startDate and endDate",
          }),
        };
      }

      // Basic date validation
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start >= end) {
          throw new Error("startDate must be before endDate");
        }
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            /* CORS headers */
          },
          body: JSON.stringify({
            success: false,
            error: error.message,
          }),
        };
      }
    }

    // Invoke with appropriate parameters
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: JSON.stringify({
        mode,
        cleanup,
        startDate,
        endDate,
        httpMethod: "POST",
        // ... other fields
      }),
    });

    // ... rest of implementation
  } catch (error) {
    // ... error handling
  }
}
```

### Step 5: Create Dedicated Historical Digest Endpoint (Optional)

**File**: `functions/handlers/aws/historical-digest.ts` (new file)

```typescript
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

const sfnClient = new SFNClient();

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || "{}");
    const { startDate, endDate, batchSize = 200 } = body;

    // Validate inputs
    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required parameters: startDate, endDate",
        }),
      };
    }

    // Start Step Functions execution directly
    const command = new StartExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN,
      input: JSON.stringify({
        mode: "historical",
        startDate,
        endDate,
        batchSize,
        includeArchived: true,
      }),
    });

    const result = await sfnClient.send(command);

    return {
      statusCode: 202,
      body: JSON.stringify({
        success: true,
        message: "Historical digest processing started",
        executionArn: result.executionArn,
        dateRange: { start: startDate, end: endDate },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
}
```

### Step 6: Update Step Functions Pipeline Definition

**File**: `terraform/aws/stepfunctions/ai-digest-pipeline.asl.json`

Update the FetchEmails state to pass through historical parameters:

```json
{
  "FetchEmails": {
    "Type": "Task",
    "Resource": "arn:aws:states:::lambda:invoke",
    "Parameters": {
      "FunctionName": "${email_fetcher_arn}",
      "Payload": {
        "input.$": "$",
        "executionId.$": "$$.Execution.Id",
        "startTime.$": "$$.Execution.StartTime",
        "mode.$": "$.mode",
        "startDate.$": "$.startDate",
        "endDate.$": "$.endDate",
        "batchSize.$": "$.batchSize"
      }
    }
    // ... rest of configuration
  }
}
```

## Validation & Error Handling

### Input Validation Checklist

```typescript
function validateHistoricalRequest(request: HistoricalDigestRequest): void {
  // 1. Check required fields
  if (!request.startDate || !request.endDate) {
    throw new Error("startDate and endDate are required for historical mode");
  }

  // 2. Validate date formats
  const start = new Date(request.startDate);
  const end = new Date(request.endDate);

  if (isNaN(start.getTime())) {
    throw new Error("Invalid startDate format. Use YYYY-MM-DD");
  }

  if (isNaN(end.getTime())) {
    throw new Error("Invalid endDate format. Use YYYY-MM-DD");
  }

  // 3. Check date order
  if (start >= end) {
    throw new Error("startDate must be before endDate");
  }

  // 4. Check future dates
  const now = new Date();
  if (end > now) {
    throw new Error("endDate cannot be in the future");
  }

  // 5. Check date range limit
  const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 90) {
    throw new Error("Date range cannot exceed 90 days for cost control");
  }

  // 6. Check minimum date (optional)
  const minDate = new Date("2020-01-01");
  if (start < minDate) {
    throw new Error("Cannot query emails before 2020");
  }
}
```

### Error Response Examples

```json
// Invalid date format
{
  "statusCode": 400,
  "error": "Invalid startDate format. Use YYYY-MM-DD",
  "example": "2024-12-25"
}

// Date range too large
{
  "statusCode": 400,
  "error": "Date range cannot exceed 90 days for cost control",
  "requestedDays": 120,
  "maxDays": 90
}

// Future date
{
  "statusCode": 400,
  "error": "endDate cannot be in the future",
  "providedDate": "2025-12-31",
  "currentDate": "2025-08-20"
}
```

## API Contract Examples

### Request Examples

#### Basic Historical Request

```bash
curl -X POST https://api.ai-digest.com/historical \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "historical",
    "startDate": "2024-12-01",
    "endDate": "2024-12-31"
  }'
```

#### With Optional Parameters

```json
{
  "mode": "historical",
  "startDate": "2024-11-01",
  "endDate": "2024-11-30",
  "batchSize": 100,
  "includeArchived": true,
  "maxEmails": 500
}
```

#### Year-End Summary Request

```json
{
  "mode": "historical",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "batchSize": 50
}
```

### Response Examples

#### Success Response

```json
{
  "statusCode": 202,
  "success": true,
  "message": "Historical digest processing started",
  "executionArn": "arn:aws:states:us-east-1:123456789:execution:ai-digest-pipeline:historical-2024-12",
  "dateRange": {
    "start": "2024-12-01",
    "end": "2024-12-31",
    "days": 31
  },
  "estimatedEmails": 150,
  "mode": "historical",
  "invocationId": "abc-123-def",
  "timestamp": "2025-08-20T10:30:00Z"
}
```

#### Processing Complete Response

```json
{
  "success": true,
  "emailsFound": 145,
  "emailsProcessed": 42,
  "aiEmailsIdentified": 42,
  "dateRange": {
    "start": "2024-12-01",
    "end": "2024-12-31"
  },
  "digest": {
    "sent": true,
    "recipient": "user@example.com",
    "subject": "AI Digest: Historical Summary (Dec 1-31, 2024)"
  },
  "costs": {
    "gmail": 0.0,
    "openai": 0.23,
    "firecrawl": 0.05,
    "total": 0.28
  },
  "processingTime": "2m 34s"
}
```

## Testing Strategy

### Unit Tests

#### Date Validation Tests

```typescript
describe("Historical Mode Date Validation", () => {
  it("should accept valid date range", () => {
    expect(() => validateDateRange("2024-12-01", "2024-12-31")).not.toThrow();
  });

  it("should reject invalid date format", () => {
    expect(() => validateDateRange("12/01/2024", "12/31/2024")).toThrow(
      /Invalid date format/
    );
  });

  it("should reject startDate after endDate", () => {
    expect(() => validateDateRange("2024-12-31", "2024-12-01")).toThrow(
      /before endDate/
    );
  });

  it("should reject future dates", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    expect(() =>
      validateDateRange("2024-12-01", futureDate.toISOString())
    ).toThrow(/future/);
  });

  it("should reject ranges over 90 days", () => {
    expect(() => validateDateRange("2024-01-01", "2024-06-01")).toThrow(
      /exceed 90 days/
    );
  });
});
```

#### Gmail Query Construction Tests

```typescript
describe("Gmail Query Construction", () => {
  it("should format historical query correctly", () => {
    const query = buildHistoricalQuery("2024-12-01", "2024-12-31");
    expect(query).toBe("after:2024/12/1 before:2024/12/31");
  });

  it("should not include inbox restriction for historical", () => {
    const query = buildHistoricalQuery("2024-12-01", "2024-12-31");
    expect(query).not.toContain("in:inbox");
  });

  it("should handle single-digit months and days", () => {
    const query = buildHistoricalQuery("2024-01-05", "2024-02-09");
    expect(query).toBe("after:2024/1/5 before:2024/2/9");
  });
});
```

### Integration Tests

#### End-to-End Historical Digest Test

```typescript
describe("Historical Digest Integration", () => {
  it("should process historical digest request", async () => {
    const response = await invokeHistoricalDigest({
      startDate: "2024-12-01",
      endDate: "2024-12-07",
    });

    expect(response.statusCode).toBe(202);
    expect(response.body.executionArn).toBeDefined();

    // Wait for processing
    const result = await waitForExecution(response.body.executionArn);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.output.emailsProcessed).toBeGreaterThan(0);
  });

  it("should include archived emails", async () => {
    // Archive some test emails first
    await archiveTestEmails(["email1", "email2"]);

    const response = await invokeHistoricalDigest({
      startDate: "2024-12-01",
      endDate: "2024-12-31",
    });

    const result = await waitForExecution(response.body.executionArn);
    const processedIds = result.output.processedEmailIds;

    expect(processedIds).toContain("email1");
    expect(processedIds).toContain("email2");
  });
});
```

### Performance Tests

```typescript
describe("Historical Mode Performance", () => {
  it("should handle large date ranges efficiently", async () => {
    const startTime = Date.now();

    const response = await invokeHistoricalDigest({
      startDate: "2024-10-01",
      endDate: "2024-12-31", // 3 months
      batchSize: 50,
    });

    const result = await waitForExecution(response.body.executionArn);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(300000); // 5 minutes
    expect(result.output.costs.total).toBeLessThan(1.0); // Under $1
  });
});
```

## Cost Implications

### Cost Factors

1. **Gmail API**: Free (within quotas)
2. **OpenAI API**: ~$0.001 per email for classification, ~$0.01 per summary
3. **Lambda Execution**: ~$0.0000002 per 100ms
4. **Step Functions**: $0.025 per 1,000 state transitions
5. **DynamoDB**: Minimal for sender storage

### Cost Estimation Formula

```typescript
function estimateCost(emailCount: number): number {
  const classificationCost = emailCount * 0.001;
  const summaryCount = Math.floor(emailCount * 0.3); // ~30% are AI emails
  const summaryCost = summaryCount * 0.01;
  const infrastructureCost = 0.05; // Fixed overhead

  return classificationCost + summaryCost + infrastructureCost;
}

// Examples:
// 100 emails: ~$0.35
// 500 emails: ~$1.55
// 1000 emails: ~$3.05
```

### Cost Control Strategies

1. **Progressive Cost Checking**: Check costs after each stage
2. **Hard Limits**: Stop processing if cost exceeds limit
3. **Batch Size Control**: Smaller batches for large date ranges
4. **Caching**: Reuse sender classifications
5. **Skip Non-Essential**: Disable Research/Critic agents for large batches

## Monitoring & Observability

### CloudWatch Metrics

```typescript
// Custom metrics to track
const metrics = {
  "historical.requests": "Count of historical digest requests",
  "historical.date_range_days": "Size of date range in days",
  "historical.emails_found": "Total emails in date range",
  "historical.emails_processed": "AI emails processed",
  "historical.processing_time": "Total processing duration",
  "historical.cost": "Total cost per run",
  "historical.errors": "Error count by type",
};
```

### CloudWatch Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "historical_cost_alarm" {
  alarm_name          = "ai-digest-historical-high-cost"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name        = "historical.cost"
  namespace          = "AIDigest"
  period             = "300"
  statistic          = "Maximum"
  threshold          = "5.00"
  alarm_description  = "Historical digest cost exceeded $5"
}
```

### Logging Strategy

```typescript
// Structured logging for historical mode
log.info(
  {
    mode: "historical",
    dateRange: { start: startDate, end: endDate, days: dayCount },
    stage: "email_fetch",
    emailsFound: 145,
    apiCalls: 3,
    duration: 2340,
    correlationId: executionId,
  },
  "Historical digest: email fetch complete"
);
```

## Deployment Steps

### 1. Code Deployment

```bash
# Update Lambda functions
bun run build:aws
bun run update:aws

# Or full deployment with Terraform
cd terraform/aws
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

### 2. Configuration Updates

```bash
# Update Lambda environment variables if needed
aws lambda update-function-configuration \
  --function-name ai-digest-run-now \
  --environment Variables={ENABLE_HISTORICAL=true}
```

### 3. Testing in Production

```bash
# Test with small date range first
curl -X POST https://api.ai-digest.com/run-now \
  -d '{
    "mode": "historical",
    "startDate": "2024-12-20",
    "endDate": "2024-12-22"
  }'

# Monitor execution
aws stepfunctions describe-execution \
  --execution-arn "arn:aws:states:..."
```

## Rollback Plan

If issues arise with historical mode:

1. **Feature Flag**: Disable via environment variable
2. **Revert Code**: Git revert and redeploy
3. **Stop Executions**: Cancel running Step Functions
4. **Clear Cache**: Remove any cached historical data

```bash
# Emergency rollback
git revert HEAD
bun run build:aws
bun run update:aws

# Stop running executions
aws stepfunctions stop-execution --execution-arn "..."
```

## Future Enhancements

### Phase 2 Features

1. **Comparative Analysis**: Compare multiple time periods
2. **Scheduled Historical Reports**: Monthly/quarterly summaries
3. **Export Formats**: PDF, CSV, JSON exports
4. **Advanced Filters**: Filter by sender, topic, or keyword
5. **Incremental Processing**: Resume interrupted historical digests

### Phase 3 Features

1. **UI Dashboard**: Web interface for date selection
2. **Visualization**: Charts and graphs of AI news trends
3. **Multi-User Support**: User-specific historical digests
4. **Archive Management**: Automatic archival policies
5. **ML Insights**: Trend prediction and anomaly detection

### API Enhancements

```typescript
// Future API capabilities
{
  "mode": "historical",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "filters": {
    "senders": ["openai", "anthropic"],
    "topics": ["GPT", "Claude"],
    "excludeTopics": ["crypto"]
  },
  "output": {
    "format": "pdf",
    "groupBy": "month",
    "includeCharts": true
  },
  "comparison": {
    "enabled": true,
    "previousPeriod": "2023"
  }
}
```

## Appendix

### Gmail Query Syntax Reference

- `after:YYYY/M/D` - Messages after this date
- `before:YYYY/M/D` - Messages before this date
- `older_than:Xd` - Messages older than X days
- `newer_than:Xd` - Messages newer than X days
- `in:inbox` - Only inbox messages
- `in:anywhere` - All messages including archived
- `from:sender@example.com` - From specific sender

### Common Date Range Examples

```javascript
// Last month
const lastMonth = {
  startDate: new Date(new Date().setMonth(new Date().getMonth() - 1, 1)),
  endDate: new Date(new Date().setDate(0)),
};

// Last quarter
const lastQuarter = {
  Q1: { start: "2024-01-01", end: "2024-03-31" },
  Q2: { start: "2024-04-01", end: "2024-06-30" },
  Q3: { start: "2024-07-01", end: "2024-09-30" },
  Q4: { start: "2024-10-01", end: "2024-12-31" },
};

// Year to date
const yearToDate = {
  startDate: new Date(new Date().getFullYear(), 0, 1),
  endDate: new Date(),
};
```

### Troubleshooting Guide

| Issue                   | Cause                       | Solution                                |
| ----------------------- | --------------------------- | --------------------------------------- |
| No emails found         | Date range too restrictive  | Check if emails exist in range          |
| High costs              | Large date range            | Reduce batch size or date range         |
| Timeout errors          | Too many emails             | Increase Lambda timeout or reduce batch |
| Missing archived emails | Query includes inbox filter | Remove "in:inbox" from query            |
| Invalid date errors     | Wrong format                | Use ISO format (YYYY-MM-DD)             |

### Support & Resources

- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: This guide and inline code comments
- **Monitoring**: CloudWatch dashboards and alarms
- **Contact**: <ai-digest@journaler.me>

---

_Last Updated: 2025-08-20_
_Version: 1.0.0_
_Author: AI Digest Team_
