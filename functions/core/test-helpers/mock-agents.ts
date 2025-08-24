import { vi } from "vitest";
import type { Classification } from "../../lib/agents/ClassifierAgent";
import type { EmailBatch, FetchEmailsOptions } from "../../lib/agents/EmailFetcherAgent";
import type { CostTracker } from "../../lib/cost-tracker";

// Mock EmailFetcherAgent
export class MockEmailFetcherAgent {
  private gmail: any;
  private batchOps: any;
  private costTracker: CostTracker;

  constructor(costTracker: CostTracker) {
    this.costTracker = costTracker;
    // Don't use the real googleapis at all - just create mock objects
    this.gmail = {
      users: {
        messages: {
          list: vi.fn().mockResolvedValue({ data: { messages: [] } }),
          get: vi.fn().mockResolvedValue({ data: {} }),
          batchModify: vi.fn().mockResolvedValue({ data: {} }),
        },
      },
    };
    this.batchOps = {
      archiveEmails: vi.fn().mockResolvedValue(undefined),
      batchMarkReadAndArchive: vi.fn().mockResolvedValue(undefined),
    };
  }

  async fetchEmails(_options: FetchEmailsOptions): Promise<EmailBatch> {
    // Use the mocked googleapis instead of internal mock
    const { google } = require("googleapis");
    const gmail = google.gmail();

    const messages = await gmail.users.messages.list({ userId: "me" });
    const fullEmails: any[] = [];
    const metadata: any[] = [];

    if (messages.data?.messages) {
      for (const msg of messages.data.messages) {
        const full = await gmail.users.messages.get({ userId: "me", id: msg.id });
        if (full.data) {
          // Parse the email data to extract metadata
          const headers = full.data.payload?.headers || [];
          const fromHeader = headers.find((h: any) => h.name === "From");
          const subjectHeader = headers.find((h: any) => h.name === "Subject");
          const dateHeader = headers.find((h: any) => h.name === "Date");

          const email = {
            id: full.data.id,
            from: fromHeader?.value || "",
            subject: subjectHeader?.value || "",
            snippet: full.data.snippet || full.data.payload?.snippet || "",
            body: full.data.payload?.body?.data
              ? Buffer.from(full.data.payload.body.data, "base64").toString()
              : "",
            date: dateHeader?.value || formatISO(new Date()),
            payload: full.data.payload,
          };

          fullEmails.push(email);
          metadata.push({
            id: email.id,
            from: email.from,
            subject: email.subject,
            snippet: email.snippet,
          });
        }
      }
    }

    return {
      fullEmails,
      metadata,
      aiEmailIds: [],
      unknownEmailIds: fullEmails.map((e) => e.id),
      classifications: new Map(),
      stats: {
        totalFetched: fullEmails.length,
        knownAI: 0,
        knownNonAI: 0,
        unknown: fullEmails.length,
        archived: 0,
      },
    };
  }

  getBatchOperations() {
    return this.batchOps;
  }
}

// Mock ClassifierAgent
export class MockClassifierAgent {
  private costTracker: CostTracker;

  constructor(costTracker: CostTracker) {
    this.costTracker = costTracker;
  }

  async classifyEmails(
    _emailBatch: EmailBatch,
    _isCleanupMode = false
  ): Promise<Map<string, Classification>> {
    // Use the mocked generateObject
    const { generateObject } = require("ai");
    const result = await generateObject();

    const classifications = new Map<string, Classification>();

    if (result?.object?.classifications) {
      for (const cls of result.object.classifications) {
        classifications.set(cls.emailId, {
          classification: cls.classification,
          confidence: cls.confidence,
        });
      }
    }

    return classifications;
  }
}

// Mock ContentExtractorAgent
export class MockContentExtractorAgent {
  private costTracker: CostTracker;

  constructor(costTracker: CostTracker) {
    this.costTracker = costTracker;
  }

  async extractContent(emails: any[]): Promise<any[]> {
    const { generateObject } = require("ai");
    const result = await generateObject();
    return result?.object?.emails || emails;
  }
}

// Mock ResearchAgent
export class MockResearchAgent {
  private costTracker: CostTracker;

  constructor(costTracker: CostTracker) {
    this.costTracker = costTracker;
  }

  async research(emails: any[]): Promise<any[]> {
    const { generateObject } = require("ai");
    const result = await generateObject();
    return result?.object?.emails || emails;
  }
}

// Mock AnalysisAgent
export class MockAnalysisAgent {
  private costTracker: CostTracker;

  constructor(costTracker: CostTracker) {
    this.costTracker = costTracker;
  }

  async analyze(_emails: any[]): Promise<any> {
    const { generateObject } = require("ai");
    const result = await generateObject();
    return (
      result?.object || {
        whatHappened: [],
        takeaways: [],
        productPlays: [],
        tools: [],
      }
    );
  }
}

// Mock CriticAgent
export class MockCriticAgent {
  private costTracker: CostTracker;

  constructor(costTracker: CostTracker) {
    this.costTracker = costTracker;
  }

  async generateCommentary(_analysis: any): Promise<any> {
    const { generateObject } = require("ai");
    const result = await generateObject();
    return (
      result?.object?.commentary || {
        spicyTake: "",
        reality: "",
        contrarian: "",
      }
    );
  }
}
