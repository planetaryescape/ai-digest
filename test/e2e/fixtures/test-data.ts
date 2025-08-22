export const testEmails = [
  {
    id: "msg-001",
    threadId: "thread-001",
    subject: "Latest in AI: GPT-5 Released",
    from: "AI Weekly Newsletter <news@aiweekly.com>",
    body: "OpenAI has announced the release of GPT-5 with groundbreaking capabilities...",
    snippet: "OpenAI has announced the release of GPT-5...",
    receivedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    labelIds: ["INBOX", "UNREAD"],
  },
  {
    id: "msg-002",
    threadId: "thread-002",
    subject: "Machine Learning Breakthrough",
    from: "Tech Digest <digest@techdigest.com>",
    body: "Researchers at MIT have developed a new machine learning algorithm...",
    snippet: "Researchers at MIT have developed...",
    receivedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    labelIds: ["INBOX", "UNREAD"],
  },
  {
    id: "msg-003",
    threadId: "thread-003",
    subject: "Your Weekly AI Roundup",
    from: "The AI Report <report@aireport.com>",
    body: "This week in AI: Major advancements in computer vision and NLP...",
    snippet: "This week in AI: Major advancements...",
    receivedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    labelIds: ["INBOX", "UNREAD"],
  },
];

export const testConfig = {
  gmail: {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    refreshToken: "test-refresh-token",
  },
  openai: {
    apiKey: "test-openai-key",
    model: "gpt-4o",
  },
  resend: {
    apiKey: "test-resend-key",
    from: "test@aidig.dev",
    to: "recipient@example.com",
  },
  aws: {
    region: "us-east-1",
    dynamoTable: "test-ai-digest",
    s3Bucket: "test-ai-digest-bucket",
  },
  costLimits: {
    maxCostPerRun: 1.0,
    maxEmailsPerRun: 500,
  },
};

export const mockGmailResponse = {
  messages: testEmails.map((email) => ({
    id: email.id,
    threadId: email.threadId,
  })),
  resultSizeEstimate: testEmails.length,
};

export const mockOpenAIResponse = {
  id: "chatcmpl-test",
  object: "chat.completion",
  created: Date.now(),
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          classified: true,
          confidence: 0.95,
          category: "ai-ml",
        }),
      },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
};
