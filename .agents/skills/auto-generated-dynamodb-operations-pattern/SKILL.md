---
name: auto-generated-dynamodb-operations-pattern
description: DynamoDB patterns for sender tracking. Client setup, marshall/unmarshall, CRUD operations, GSI queries, batch writes. Triggers on "dynamodb", "sender tracking", "known senders", "batch write".
---

# DynamoDB Operations

Project uses AWS SDK v3 DynamoDB client with marshall/unmarshall utilities. Two tables: AI senders and non-AI senders.

## Client Initialization

Standard pattern across project:

```typescript
// From dynamodb-sender-tracker.ts
private client: DynamoDBClient;
private tableName: string;

constructor() {
  this.client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  this.tableName = process.env.DYNAMODB_TABLE || "ai-digest-known-ai-senders";
}
```

For multiple tables:

```typescript
// From enhanced-sender-tracker.ts
private aiSendersTable: string;
private nonAiSendersTable: string;

constructor() {
  this.client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  this.aiSendersTable = process.env.DYNAMODB_TABLE || "ai-digest-known-ai-senders";
  this.nonAiSendersTable = process.env.DYNAMODB_NON_AI_TABLE || "ai-digest-known-non-ai-senders";
}
```

## Marshall/Unmarshall Pattern

**ALWAYS use marshall for writes, unmarshall for reads:**

```typescript
// GetItem - marshall keys, unmarshall response
const response = await this.client.send(
  new GetItemCommand({
    TableName: this.tableName,
    Key: marshall({ senderEmail: email.toLowerCase() }),
  })
);

if (response.Item) {
  const sender = unmarshall(response.Item) as KnownSender;
  return sender.confidence >= 70;
}
```

**Remove undefined values on write:**

```typescript
// From dynamodb-sender-tracker.ts line 159
await this.client.send(
  new PutItemCommand({
    TableName: this.tableName,
    Item: marshall(newSender, { removeUndefinedValues: true }),
  })
);
```

## GetItem Pattern

Simple lookup by primary key:

```typescript
// From dynamodb-sender-tracker.ts
const response = await this.client.send(
  new GetItemCommand({
    TableName: this.tableName,
    Key: marshall({ senderEmail: email.toLowerCase() }),
  })
);

if (response.Item) {
  const sender = unmarshall(response.Item) as KnownSender;
  // Use sender data
}
```

## PutItem Pattern

Full item replacement (creates or overwrites):

```typescript
// From enhanced-sender-tracker.ts line 236
await this.client.send(
  new PutItemCommand({
    TableName: this.nonAiSendersTable,
    Item: marshall({
      senderEmail: email,
      domain,
      senderName: sender.name || existing?.senderName || email,
      confidence: sender.confidence || 90,
      lastClassified: now,
      classificationCount: (existing?.classificationCount || 0) + 1,
      ttl,
    }),
  })
);
```

## UpdateItem Pattern

**Use ExpressionAttributeNames and ExpressionAttributeValues:**

```typescript
// From dynamodb-sender-tracker.ts line 114
await this.client.send(
  new UpdateItemCommand({
    TableName: this.tableName,
    Key: marshall({ senderEmail: email }),
    UpdateExpression:
      "SET #lastSeen = :lastSeen, #emailCount = :emailCount, " +
      "#confidence = :confidence" +
      (sender.name ? ", #senderName = :senderName" : "") +
      (sender.newsletterName ? ", #newsletterName = :newsletterName" : ""),
    ExpressionAttributeNames: {
      "#lastSeen": "lastSeen",
      "#emailCount": "emailCount",
      "#confidence": "confidence",
      ...(sender.name && { "#senderName": "senderName" }),
      ...(sender.newsletterName && { "#newsletterName": "newsletterName" }),
    },
    ExpressionAttributeValues: marshall({
      ":lastSeen": now,
      ":emailCount": existingSender.emailCount + 1,
      ":confidence": Math.min(100, existingSender.confidence + 5),
      ...(sender.name && { ":senderName": sender.name }),
      ...(sender.newsletterName && { ":newsletterName": sender.newsletterName }),
    }),
  })
);
```

**Conditional attributes with spread:**

```typescript
// From enhanced-sender-tracker.ts line 396
UpdateExpression:
  "SET #domain = :domain, #senderName = :senderName, #confirmedAt = :confirmedAt, " +
  "#confidence = :confidence, #lastSeen = :lastSeen, #emailCount = :emailCount" +
  (sender.newsletterName ? ", #newsletterName = :newsletterName" : ""),
ExpressionAttributeNames: {
  "#domain": "domain",
  "#senderName": "senderName",
  ...(sender.newsletterName && { "#newsletterName": "newsletterName" }),
},
ExpressionAttributeValues: marshall({
  ":domain": domain,
  ":senderName": sanitizeForDynamoDB(sender.name, email),
  ...(sender.newsletterName && {
    ":newsletterName": sanitizeForDynamoDB(sender.newsletterName),
  }),
}),
```

## Query with GSI

**DomainIndex GSI for querying by domain:**

```typescript
// From dynamodb-sender-tracker.ts line 68
const response = await this.client.send(
  new QueryCommand({
    TableName: this.tableName,
    IndexName: "DomainIndex",
    KeyConditionExpression: "#domain = :domain",
    ExpressionAttributeNames: {
      "#domain": "domain",
    },
    ExpressionAttributeValues: marshall({
      ":domain": domain.toLowerCase(),
    }),
  })
);

if (!response.Items) {
  return [];
}

return response.Items.map((item) => unmarshall(item) as KnownSender);
```

## Scan Pattern

Get all items (expensive, avoid if possible):

```typescript
// From dynamodb-sender-tracker.ts line 49
const response = await this.client.send(
  new ScanCommand({
    TableName: this.tableName,
  })
);

if (!response.Items) {
  return [];
}

return response.Items.map((item) => unmarshall(item) as KnownSender);
```

## Batch Write (25-Item Limit)

**CRITICAL: DynamoDB batch limit is 25 items per request:**

```typescript
// From dynamodb-sender-tracker.ts line 176
const batchSize = 25;
const now = new Date().toISOString();

for (let i = 0; i < senders.length; i += batchSize) {
  const batch = senders.slice(i, i + batchSize);
  const putRequests = batch.map((sender) => {
    const email = sender.email.toLowerCase();
    const domain = email.split("@")[1] || "";

    const item: KnownSender = {
      senderEmail: email,
      domain,
      senderName: sender.name,
      newsletterName: sender.newsletterName,
      confirmedAt: now,
      lastSeen: now,
      confidence: 90,
      emailCount: 1,
    };

    return {
      PutRequest: {
        Item: marshall(item, { removeUndefinedValues: true }),
      },
    };
  });

  try {
    await this.client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [this.tableName]: putRequests,
        },
      })
    );
  } catch (error) {
    console.error("Error batch adding senders:", error);
    // Continue with next batch even if one fails
  }
}
```

## Confidence Score Updates

**Incremental confidence increase pattern:**

```typescript
// From dynamodb-sender-tracker.ts line 135
":confidence": Math.min(100, existingSender.confidence + 5), // Cap at 100

// From enhanced-sender-tracker.ts line 390
const newConfidence = Math.min(100, (existing?.confidence || 70) + 5);
```

**Bounded confidence update:**

```typescript
// From dynamodb-sender-tracker.ts line 230
":confidence": Math.min(100, Math.max(0, confidence)), // 0-100 range
```

## Email Count Tracking

**Increment pattern:**

```typescript
// From dynamodb-sender-tracker.ts line 134
":emailCount": existingSender.emailCount + 1,

// From enhanced-sender-tracker.ts line 244
classificationCount: (existing?.classificationCount || 0) + 1,
```

## TTL Pattern

**Set TTL for auto-deletion (Unix timestamp in seconds):**

```typescript
// From enhanced-sender-tracker.ts line 229
const now = Date.now();
const ttl = Math.floor(now / 1000) + this.ttlDays * 24 * 60 * 60;

await this.client.send(
  new PutItemCommand({
    TableName: this.nonAiSendersTable,
    Item: marshall({
      senderEmail: email,
      domain,
      ttl, // DynamoDB expects seconds since epoch
    }),
  })
);
```

## Data Sanitization

**Always sanitize before DynamoDB write (no empty strings):**

```typescript
// From enhanced-sender-tracker.ts line 23
function sanitizeForDynamoDB(
  value: string | undefined | null,
  defaultValue: string = "unknown"
): string {
  if (!value || value.trim() === "") {
    return defaultValue;
  }
  return value;
}

// Usage
senderName: sanitizeForDynamoDB(sender.name, email),
domain: extractDomain(email), // Never returns empty string
```

## Error Handling

**Graceful degradation on errors:**

```typescript
// From dynamodb-sender-tracker.ts line 41
try {
  const response = await this.client.send(
    new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ senderEmail: email.toLowerCase() }),
    })
  );
  // ... process response
} catch (error) {
  console.error("Error checking known sender:", error);
  return false; // Safe default
}
```

**Continue batch processing on failure:**

```typescript
// From dynamodb-sender-tracker.ts line 212
try {
  await this.client.send(
    new BatchWriteItemCommand({
      RequestItems: {
        [this.tableName]: putRequests,
      },
    })
  );
} catch (error) {
  console.error("Error batch adding senders:", error);
  // Continue with next batch even if one fails
}
```

## Key Files

- `functions/lib/aws/dynamodb-sender-tracker.ts` - Basic CRUD operations
- `functions/lib/aws/enhanced-sender-tracker.ts` - Advanced patterns (TTL, multi-table, confidence decay)
- `functions/lib/interfaces/sender-tracker.ts` - Interface definitions
- `terraform/aws/dynamodb.tf` - Table schemas and GSI definitions

## Common Patterns

1. **Always lowercase emails**: `email.toLowerCase()`
2. **Extract domain safely**: `email.split("@")[1] || ""`
3. **Use ISO strings for dates**: `new Date().toISOString()`
4. **Use timestamps for TTL**: `Math.floor(Date.now() / 1000)`
5. **Remove undefined values**: `marshall(item, { removeUndefinedValues: true })`
6. **Batch limit is 25**: Split large arrays into chunks
7. **Confidence range**: `Math.min(100, Math.max(0, value))`
8. **Use ExpressionAttributeNames**: Avoid reserved words like "domain"

## Avoid

- Don't use empty strings (DynamoDB rejects them)
- Don't exceed 25 items in batch writes
- Don't forget to unmarshall response.Items
- Don't skip error handling on table operations
- Don't use milliseconds for TTL (must be seconds)
- Don't forget to check `if (!response.Items)` before mapping
- Don't use reserved words without ExpressionAttributeNames
