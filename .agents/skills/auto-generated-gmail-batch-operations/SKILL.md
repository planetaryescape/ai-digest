---
name: auto-generated-gmail-batch-operations
description: Gmail API batch operations for this project. Metadata-first fetching, known sender categorization, DynamoDB token management, batch archiving. Triggers on "gmail", "batch operations", "email fetching", "archive", "label".
---

# Gmail Batch Operations

70% API reduction via metadata-first approach and known sender categorization.

## Metadata-First Pattern

Fetch message list first, then batch get full messages. Don't fetch all details upfront.

```typescript
// From EmailFetcherAgent.ts lines 136-139
const messages = await this.fetchMessages(query, options.batchSize);
const fullEmails = await this.fetchFullMessages(messages);
```

List uses `gmail.users.messages.list()` with query, then batch fetch IDs only:

```typescript
// From EmailFetcherAgent.ts lines 237-243
const response = await this.gmail?.users.messages.list({
  userId: "me",
  q: query,
  maxResults: Math.min(batchSize, BATCH_LIMITS.GMAIL_API),
  pageToken,
});
```

## Known Sender Categorization

Check senders against DynamoDB before classification. Avoids re-analyzing known newsletters.

```typescript
// From EmailFetcherAgent.ts lines 323-344
private async categorizeBySender(emails: any[]): Promise<any> {
  const knownAISenders = await this.getKnownSenders("ai-digest-known-ai-senders");
  const knownNonAISenders = await this.getKnownSenders("ai-digest-known-non-ai-senders");

  const aiEmailIds: string[] = [];
  const unknownEmailIds: string[] = [];
  let knownNonAICount = 0;

  const categorizedEmails = emails.map((email) => {
    const senderEmail = this.extractEmailAddress(email.sender);

    if (knownAISenders.has(senderEmail)) {
      aiEmailIds.push(email.id);
      return { ...email, isKnownAI: true };
    }
    if (knownNonAISenders.has(senderEmail)) {
      knownNonAICount++;
      return { ...email, isKnownNonAI: true };
    }
    unknownEmailIds.push(email.id);
    return { ...email, isUnknown: true };
  });
}
```

DynamoDB query pattern:

```typescript
// From EmailFetcherAgent.ts lines 372-380
const response = await this.dynamodb.send(
  new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": "SENDER",
    },
  })
);
```

## Batch Message Retrieval

Batch size limit: 100 messages. Split into chunks, rate limit between batches.

```typescript
// From gmail-batch-operations.ts lines 14-28
async batchGetMessages(messageIds: string[]): Promise<any[]> {
  const messages: any[] = [];
  const batches = this.createBatches(messageIds, BATCH_LIMITS.GMAIL_API);

  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map((id) => this.getMessage(id)));
    messages.push(...batchResults.filter(Boolean));

    // Rate limiting between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.GMAIL_BATCH_DELAY_MS));
    }
  }

  return messages;
}
```

Batch creation helper:

```typescript
// From gmail-batch-operations.ts lines 84-90
private createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}
```

## Auth Error Detection

Check for invalid tokens, expired refresh tokens, permission errors. Return typed errors.

```typescript
// From EmailFetcherAgent.ts lines 13
export type AuthErrorType = "INVALID_REFRESH_TOKEN" | "AUTH_FAILED" | "NO_CREDENTIALS";
```

Error handling pattern:

```typescript
// From EmailFetcherAgent.ts lines 170-201
catch (error: any) {
  const errorMessage = error?.message || String(error);
  const errorCode = error?.code;

  if (
    errorMessage.includes("invalid_grant") ||
    errorMessage.includes("Token has been expired or revoked") ||
    errorMessage.includes("refresh token") ||
    errorCode === 401
  ) {
    return {
      ...emptyBatch,
      authError: {
        type: "INVALID_REFRESH_TOKEN",
        message: "Gmail refresh token is invalid or expired. Please re-authorize via the dashboard.",
      },
    };
  }

  if (errorCode === 403 || errorMessage.includes("Forbidden")) {
    return {
      ...emptyBatch,
      authError: {
        type: "AUTH_FAILED",
        message: "Gmail API access denied. Please check API permissions and re-authorize.",
      },
    };
  }

  throw error;
}
```

## Token Management

Token stored in DynamoDB, falls back to env var. Initialize once, reuse client.

```typescript
// From EmailFetcherAgent.ts lines 73-98
private async initialize(): Promise<{ error?: { type: AuthErrorType; message: string } }> {
  if (this.initialized) {
    return {};
  }

  const tokenData = await getStoredToken();

  if (!tokenData) {
    return {
      error: {
        type: "NO_CREDENTIALS",
        message: "No Gmail credentials found. Please run 'bun run generate:oauth' or re-authorize via the dashboard.",
      },
    };
  }

  this.oauth2Client.setCredentials({
    refresh_token: tokenData.refreshToken,
  });

  this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
  this.batchOps = new GmailBatchOperations(this.gmail, this.costTracker);
  this.initialized = true;

  return {};
}
```

Update last used timestamp on success:

```typescript
// From EmailFetcherAgent.ts line 160
await updateLastUsed();
```

## Email Parsing

Extract headers, decode base64 body. Handle multipart MIME.

```typescript
// From EmailFetcherAgent.ts lines 279-293
private parseMessage(message: any): any {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  return {
    id: message.id,
    threadId: message.threadId,
    subject: getHeader("subject"),
    sender: getHeader("from"),
    date: getHeader("date"),
    snippet: message.snippet,
    body: this.extractBody(message.payload),
  };
}
```

Body extraction handles nested parts:

```typescript
// From EmailFetcherAgent.ts lines 295-321
private extractBody(payload: any): string {
  if (!payload) {
    return "";
  }

  // Check for plain text part
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Check for HTML part
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Recursively check parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const body = this.extractBody(part);
      if (body) {
        return body;
      }
    }
  }

  return "";
}
```

Email address extraction from sender field:

```typescript
// From EmailFetcherAgent.ts lines 396-399
private extractEmailAddress(sender: string): string {
  const match = sender.match(/<(.+?)>/) || sender.match(/([^\s]+@[^\s]+)/);
  return match ? match[1].toLowerCase() : sender.toLowerCase();
}
```

## Archive/Modify Operations

Use `batchModify` to remove INBOX label. Batch size: 100.

```typescript
// From gmail-batch-operations.ts lines 31-59
async batchModifyMessages(
  messageIds: string[],
  modifications: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<void> {
  const batches = this.createBatches(messageIds, BATCH_LIMITS.GMAIL_API);

  for (const batch of batches) {
    try {
      await this.gmail.users.messages.batchModify({
        userId: "me",
        requestBody: {
          ids: batch,
          addLabelIds: modifications.addLabelIds,
          removeLabelIds: modifications.removeLabelIds,
        },
      });

      this.costTracker.recordApiCall("gmail", "batchModify");
      log.info({ count: batch.length }, "Batch modification complete");
    } catch (error) {
      log.error({ error, batchSize: batch.length }, "Batch modification failed");
    }

    // Rate limiting
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.GMAIL_BATCH_DELAY_MS));
    }
  }
}
```

Archiving convenience method:

```typescript
// From gmail-batch-operations.ts lines 76-82
async archiveEmails(messageIds: string[]): Promise<void> {
  log.info({ count: messageIds.length }, "Archiving emails");

  await this.batchModifyMessages(messageIds, {
    removeLabelIds: ["INBOX"],
  });
}
```

Called from agent:

```typescript
// From EmailFetcherAgent.ts lines 401-410
private async archiveEmails(emailIds: string[]): Promise<void> {
  if (!emailIds.length) {
    return;
  }

  await this.batchOps.batchModifyMessages(emailIds, {
    removeLabelIds: ["INBOX"],
  });

  log.info({ count: emailIds.length }, "Archived emails");
}
```

## Rate Limiting

1000ms delay between batches. Constants in `constants.ts`.

```typescript
// From constants.ts lines 33-34
GMAIL_BATCH_DELAY_MS: 1000,
```

Applied between batches:

```typescript
// From gmail-batch-operations.ts lines 23-25
if (batches.indexOf(batch) < batches.length - 1) {
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMITS.GMAIL_BATCH_DELAY_MS));
}
```

## Query Building

Mode-based date ranges: weekly (7 days), cleanup (7-30 days), historical (custom).

```typescript
// From EmailFetcherAgent.ts lines 208-229
private buildQuery(options: FetchEmailsOptions): string {
  let query = "in:inbox";

  if (options.mode === "weekly") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query += ` after:${weekAgo.toISOString().split("T")[0]}`;
  } else if (options.mode === "cleanup") {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query += ` after:${monthAgo.toISOString().split("T")[0]}`;
    query += ` before:${weekAgo.toISOString().split("T")[0]}`;
  } else if (options.mode === "historical" && options.startDate && options.endDate) {
    query += ` after:${options.startDate} before:${options.endDate}`;
  }

  return query;
}
```

## Constants Reference

All batch/rate limits in `functions/lib/constants.ts`:

```typescript
// From constants.ts lines 52-65
export const BATCH_LIMITS = {
  GMAIL_API: 100,              // Max per batch operation
  OPENAI_CONTEXT: 50,
  DYNAMODB_WRITE: 25,
  CLEANUP_BATCH_SIZE: 50,
  DEFAULT_BATCH_SIZE: 50,
  BATCH_DELAY_MS: 5000,
} as const;

export const RATE_LIMITS = {
  GMAIL_BATCH_SIZE: 100,
  GMAIL_BATCH_DELAY_MS: 1000,
  // ...
} as const;
```

## Key Files

- `functions/lib/agents/EmailFetcherAgent.ts` - Main fetching logic, categorization
- `functions/lib/gmail-batch-operations.ts` - Batch operations class
- `functions/lib/gmail/token-storage.ts` - DynamoDB token management
- `functions/lib/constants.ts` - Batch size and rate limit constants

## Avoid

- Don't fetch full messages without metadata-first approach
- Don't exceed 100 messages per batch (Gmail API limit)
- Don't skip rate limiting delays between batches
- Don't forget to record API calls with `costTracker.recordApiCall()`
- Don't check DynamoDB when using mock storage (check `STORAGE_TYPE`)
- Don't re-throw auth errors (return typed error objects instead)
