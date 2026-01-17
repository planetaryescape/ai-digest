---
name: auto-generated-aws-client-singleton-pattern
description: AWS SDK client initialization patterns for this project. Lazy singletons, conditional credentials, DocumentClient wrappers. Triggers on "aws client", "dynamodb", "lambda", "step functions", "singleton".
---

# AWS Client Singleton Pattern

AWS SDK clients initialized lazily as singletons. Shared across Lambda invocations. Conditional credentials for frontend vs backend.

## Lazy Singleton Pattern

Module-level null variable, getter function creates on first call:

```typescript
// From frontend/lib/aws/clients.ts
let dynamoClient: DynamoDBClient | null = null;

export function getDynamoDBClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return dynamoClient;
}
```

**Why**: Lambda reuses containers. Singleton persists across invocations. Saves ~50ms per call.

## Conditional Credentials

Frontend needs explicit credentials. Backend uses IAM role:

```typescript
// Spread pattern - adds credentials only if env vars exist
...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    }
  : {})
```

**Frontend**: Set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
**Backend**: Omit env vars, Lambda role auto-used

## DynamoDBDocumentClient Wrapper

Use DocumentClient for auto JSON marshalling:

```typescript
// From functions/lib/pipeline/StateManager.ts
constructor() {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
  });

  this.docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      convertEmptyValues: false,
      removeUndefinedValues: true,
    },
  });
}
```

**Options used**:
- `convertEmptyValues: false` - Don't convert empty strings to NULL
- `removeUndefinedValues: true` - Strip undefined properties

## Inline Client Initialization

When singleton not needed (class-scoped):

```typescript
// From functions/lib/agents/EmailFetcherAgent.ts
constructor(private costTracker: CostTracker) {
  // Direct initialization - scoped to class instance
  const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
  });
  this.dynamodb = DynamoDBDocumentClient.from(dynamoClient);
}
```

**When to use**:
- Class manages own client lifecycle
- Need instance-specific configuration
- Not shared across requests

## Token Storage Pattern

Singleton with fallback for testing:

```typescript
// From functions/lib/gmail/token-storage.ts
let client: DynamoDBClient | null = null;

function getClient(): DynamoDBClient {
  if (!client) {
    client = new DynamoDBClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return client;
}

// Use in functions
export async function getStoredToken(): Promise<TokenData | null> {
  const response = await getClient().send(
    new GetItemCommand({
      TableName: TABLE_NAME,
      Key: marshall({ userId }),
    })
  );
  // ...
}
```

**Pattern**: Private getter, public functions use it. Easy to mock for tests.

## All Clients Used

```typescript
// frontend/lib/aws/clients.ts exports these
getSFNClient()      // Step Functions
getLambdaClient()   // Lambda invocation
getDynamoDBClient() // DynamoDB operations
```

All follow same pattern:
1. Module-level null variable
2. Lazy initialization
3. Conditional credentials
4. Region from env with `us-east-1` fallback

## Region Configuration

Always use environment variable with fallback:

```typescript
region: process.env.AWS_REGION || "us-east-1"
```

**Terraform sets** `AWS_REGION` in Lambda env vars.
**Local dev** defaults to `us-east-1`.

## Client Reuse

Lambda containers persist between invocations. Module-level variables survive:

```
Invocation 1: dynamoClient = null -> create new client
Invocation 2: dynamoClient exists -> reuse (faster)
Invocation 3: dynamoClient exists -> reuse (faster)
[Container recycled]
Invocation 4: dynamoClient = null -> create new client
```

Don't recreate clients in handler functions. Use singletons.

## Anti-Patterns

**Don't**: Create client in every handler call
```typescript
// BAD - new client per invocation
export async function handler() {
  const client = new DynamoDBClient({ region: "us-east-1" });
  // ...
}
```

**Don't**: Hardcode credentials
```typescript
// BAD - credentials in code
new DynamoDBClient({
  credentials: {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
});
```

**Don't**: Hardcode region
```typescript
// BAD - hardcoded region
new DynamoDBClient({ region: "us-east-1" });

// GOOD - from env with fallback
new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
```

**Don't**: Mix raw client and DocumentClient
```typescript
// BAD - inconsistent marshalling
const client = new DynamoDBClient({});
await client.send(new PutItemCommand({
  Item: { id: { S: "123" } } // Manual marshalling
}));

const docClient = DynamoDBDocumentClient.from(client);
await docClient.send(new PutCommand({
  Item: { id: "123" } // Auto marshalling
}));

// GOOD - pick one and stick with it
// Use DocumentClient unless you need low-level control
```

## Key Files

- `frontend/lib/aws/clients.ts` - Frontend singleton exports
- `functions/lib/gmail/token-storage.ts` - Private getter pattern
- `functions/lib/pipeline/StateManager.ts` - DocumentClient wrapper with options
- `functions/lib/agents/EmailFetcherAgent.ts` - Class instance pattern

## When Each Pattern

**Module singleton** (frontend/lib/aws/clients.ts):
- Shared across entire application
- Frontend API routes
- Multiple handlers use same client

**Private getter** (functions/lib/gmail/token-storage.ts):
- Module-private singleton
- Only internal functions use it
- Easy test mocking

**Class instance** (functions/lib/agents/EmailFetcherAgent.ts):
- Agent lifecycle management
- Instance-specific config
- Not shared globally

**Inline DynamoDBDocumentClient**:
- Most backend code uses this
- Automatic JSON marshalling
- Simpler than raw DynamoDBClient
