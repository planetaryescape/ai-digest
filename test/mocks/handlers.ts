import { HttpResponse, http } from "msw";

export const handlers = [
  // Gmail API handlers
  http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", () => {
    return HttpResponse.json({
      messages: [
        { id: "msg1", threadId: "thread1" },
        { id: "msg2", threadId: "thread2" },
      ],
      nextPageToken: null,
    });
  }),

  http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      threadId: "thread1",
      labelIds: ["INBOX"],
      payload: {
        headers: [
          { name: "Subject", value: "AI Newsletter: Latest Updates" },
          { name: "From", value: "newsletter@ai-company.com" },
          { name: "Date", value: new Date().toISOString() },
        ],
        body: {
          data: "VGVzdCBlbWFpbCBjb250ZW50",
        },
      },
    });
  }),

  http.post("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify", () => {
    return HttpResponse.json({ success: true });
  }),

  // OpenAI API handlers
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

  // Resend API handlers
  http.post("https://api.resend.com/emails", () => {
    return HttpResponse.json({
      id: "email_123",
      from: "test@example.com",
      to: "recipient@example.com",
      created_at: new Date().toISOString(),
    });
  }),

  // AWS DynamoDB handlers
  http.post("https://dynamodb.us-east-1.amazonaws.com/", async ({ request }) => {
    const _body = await request.json();
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

    if (target?.includes("Scan")) {
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
  }),

  // AWS S3 handlers
  http.put("https://test-bucket.s3.us-east-1.amazonaws.com/*", () => {
    return HttpResponse.json({});
  }),

  http.get("https://test-bucket.s3.us-east-1.amazonaws.com/*", () => {
    return HttpResponse.json({
      emails: [],
    });
  }),

  // AWS Secrets Manager handlers
  http.post("https://secretsmanager.us-east-1.amazonaws.com/", () => {
    return HttpResponse.json({
      SecretString: JSON.stringify({
        gmail_client_id: "test-client-id",
        gmail_client_secret: "test-client-secret",
        gmail_refresh_token: "test-refresh-token",
        openai_api_key: "test-openai-key",
        helicone_api_key: "test-helicone-key",
        resend_api_key: "test-resend-key",
        resend_from: "test@example.com",
      }),
    });
  }),
];
