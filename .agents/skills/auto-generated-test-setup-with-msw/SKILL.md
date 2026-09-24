---
name: auto-generated-test-setup-with-msw
description: Testing setup for this project. MSW for API mocking, happy-dom environment, coverage thresholds. Triggers on "test setup", "msw", "mocking", "vitest", "testing".
---

# Test Setup with MSW

Vitest with MSW (Mock Service Worker) for external API mocking. Global setup in `test/setup.ts`, handlers in `test/mocks/handlers.ts`.

## MSW Server Setup

Setup in `test/setup.ts`:

```typescript
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});
```

**Critical**: Use `onUnhandledRequest: "error"` to catch unmocked API calls.

## HTTP Handler Patterns

Handlers in `test/mocks/handlers.ts` use MSW v2 syntax:

```typescript
import { HttpResponse, http } from "msw";

export const handlers = [
  // List endpoint
  http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", () => {
    return HttpResponse.json({
      messages: [
        { id: "msg1", threadId: "thread1" },
        { id: "msg2", threadId: "thread2" },
      ],
      nextPageToken: null,
    });
  }),

  // Detail endpoint with params
  http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      threadId: "thread1",
      payload: {
        headers: [
          { name: "Subject", value: "AI Newsletter: Latest Updates" },
          { name: "From", value: "newsletter@ai-company.com" },
        ],
        body: { data: "VGVzdCBlbWFpbCBjb250ZW50" },
      },
    });
  }),
];
```

## AWS Service Handlers

DynamoDB uses header-based operation detection:

```typescript
http.post("https://dynamodb.us-east-1.amazonaws.com/", async ({ request }) => {
  const target = request.headers.get("X-Amz-Target");

  if (target?.includes("PutItem")) {
    return HttpResponse.json({});
  }

  if (target?.includes("Query")) {
    return HttpResponse.json({
      Items: [],
      Count: 0,
    });
  }

  if (target?.includes("BatchWriteItem")) {
    return HttpResponse.json({
      UnprocessedItems: {},
    });
  }

  return HttpResponse.json({});
});
```

S3 uses wildcard paths:

```typescript
http.put("https://test-bucket.s3.us-east-1.amazonaws.com/*", () => {
  return HttpResponse.json({});
}),
```

Secrets Manager returns JSON string:

```typescript
http.post("https://secretsmanager.us-east-1.amazonaws.com/", () => {
  return HttpResponse.json({
    SecretString: JSON.stringify({
      gmail_client_id: "test-client-id",
      openai_api_key: "test-openai-key",
    }),
  });
}),
```

## Environment Variable Mocking

Set env vars directly in `test/setup.ts`:

```typescript
process.env.GMAIL_CLIENT_ID = "test-client-id";
process.env.GMAIL_CLIENT_SECRET = "test-client-secret";
process.env.GMAIL_REFRESH_TOKEN = "test-refresh-token";
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.HELICONE_API_KEY = "test-helicone-key";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_FROM = "test@example.com";
process.env.RECIPIENT_EMAIL = "recipient@example.com";
process.env.DYNAMODB_TABLE_NAME = "test-table";
process.env.S3_BUCKET = "test-bucket";
process.env.AWS_REGION = "us-east-1";
```

## Console Mocking

Reduce test noise by mocking console methods:

```typescript
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
```

Keeps original console for test framework output.

## Coverage Thresholds

Graduated thresholds per directory in `vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "json", "html", "lcov", "json-summary"],
  thresholds: {
    global: {
      statements: 50,
      branches: 50,
      functions: 50,
      lines: 50,
    },
    "functions/core/digest-processor.ts": {
      statements: 80,  // Money feature
      branches: 80,
      functions: 80,
      lines: 80,
    },
    "functions/lib/agents/*.ts": {
      statements: 75,
      branches: 75,
      functions: 75,
      lines: 75,
    },
    "functions/handlers/**/*.ts": {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
    "functions/lib/*.ts": {
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60,
    },
  },
}
```

Higher thresholds for critical paths (digest-processor, agents).

## Path Aliases

Configure aliases in `vitest.config.ts`:

```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./functions"),
    "@lib": path.resolve(__dirname, "./functions/lib"),
    "@core": path.resolve(__dirname, "./functions/core"),
    "@handlers": path.resolve(__dirname, "./functions/handlers"),
  },
},
```

Use in tests: `import { EmailFetcherAgent } from "@lib/agents/EmailFetcherAgent";`

## Test Configuration

```typescript
test: {
  globals: true,
  environment: "happy-dom",  // Lightweight DOM
  setupFiles: ["./test/setup.ts"],
  include: ["functions/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
  exclude: ["node_modules/**", "terraform/**", "frontend/**", "dist/**"],
}
```

Frontend uses separate test config (not covered here).

## OpenAI Handler Pattern

Return structured JSON in message content:

```typescript
http.post("https://api.openai.com/v1/chat/completions", () => {
  return HttpResponse.json({
    choices: [
      {
        message: {
          content: JSON.stringify({
            headline: "Test AI Digest",
            summary: "Test summary",
            whatHappened: [],
            takeaways: [],
            roleplays: [],
            productPlays: [],
            tools: [],
            shortMessage: "Test short message",
            keyThemes: ["Test theme"],
          }),
        },
      },
    ],
  });
}),
```

Matches production parsing that expects JSON string.

## Resend Handler Pattern

```typescript
http.post("https://api.resend.com/emails", () => {
  return HttpResponse.json({
    id: "email_123",
    from: "test@example.com",
    to: "recipient@example.com",
    created_at: new Date().toISOString(),
  });
}),
```

## Key Files

- `test/setup.ts` - Global setup, env vars, server lifecycle
- `test/mocks/handlers.ts` - All HTTP mocks
- `vitest.config.ts` - Config, thresholds, aliases
- `functions/**/*.test.ts` - Actual tests

## Avoid

- Don't use MSW v1 syntax (`rest.get()`) - Use v2 (`http.get()`)
- Don't mock in individual tests - Add handlers to `test/mocks/handlers.ts`
- Don't set env vars per test - Use global setup
- Don't skip `server.resetHandlers()` in `afterEach` - Causes test pollution
- Don't use `node` environment - Use `happy-dom` for faster tests
