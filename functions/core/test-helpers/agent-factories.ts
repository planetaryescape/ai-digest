import { vi } from "vitest";
import { AnalysisAgent } from "../../lib/agents/AnalysisAgent";
import { ClassifierAgent } from "../../lib/agents/ClassifierAgent";
import { ContentExtractorAgent } from "../../lib/agents/ContentExtractorAgent";
import { CriticAgent } from "../../lib/agents/CriticAgent";
import { EmailFetcherAgent } from "../../lib/agents/EmailFetcherAgent";
import { ResearchAgent } from "../../lib/agents/ResearchAgent";
import { CostTracker } from "../../lib/cost-tracker";

// Create a properly initialized CostTracker for tests
export function createTestCostTracker(): CostTracker {
  const tracker = new CostTracker();
  // Spy on methods if needed
  vi.spyOn(tracker, "trackApiCall");
  vi.spyOn(tracker, "canProceed");
  vi.spyOn(tracker, "getTotalCost");
  return tracker;
}

// Factory for creating test agents with proper initialization
export class TestAgentFactory {
  static createEmailFetcherAgent(costTracker?: CostTracker): EmailFetcherAgent {
    const tracker = costTracker || createTestCostTracker();

    // Set up environment variables for constructor
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GMAIL_CLIENT_ID: "mock-client-id",
      GMAIL_CLIENT_SECRET: "mock-client-secret",
      GMAIL_REFRESH_TOKEN: "mock-refresh-token",
      AWS_REGION: "us-east-1",
    };

    // Mock the constructor dependencies
    const agent = new EmailFetcherAgent(tracker);

    // Restore env
    process.env = originalEnv;

    // Override internal clients with mocks to ensure they work with test mocks
    const { google } = require("googleapis");
    (agent as any).gmail = google.gmail();

    (agent as any).batchOps = {
      archiveEmails: vi.fn().mockResolvedValue(undefined),
      batchMarkReadAndArchive: vi.fn().mockResolvedValue(undefined),
    };

    return agent;
  }

  static createClassifierAgent(costTracker?: CostTracker): ClassifierAgent {
    const tracker = costTracker || createTestCostTracker();
    const agent = new ClassifierAgent(tracker);

    // Override internal clients with mocks
    (agent as any).openai = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    (agent as any).dynamodb = {
      send: vi.fn(),
    };

    return agent;
  }

  static createContentExtractorAgent(costTracker?: CostTracker): ContentExtractorAgent {
    const tracker = costTracker || createTestCostTracker();
    const agent = new ContentExtractorAgent(tracker);

    // Override internal dependencies
    (agent as any).openai = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    return agent;
  }

  static createResearchAgent(costTracker?: CostTracker): ResearchAgent {
    const tracker = costTracker || createTestCostTracker();
    const agent = new ResearchAgent(tracker);

    // Override internal dependencies
    (agent as any).openai = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    return agent;
  }

  static createAnalysisAgent(costTracker?: CostTracker): AnalysisAgent {
    const tracker = costTracker || createTestCostTracker();
    const agent = new AnalysisAgent(tracker);

    // Override internal dependencies
    (agent as any).openai = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    return agent;
  }

  static createCriticAgent(costTracker?: CostTracker): CriticAgent {
    const tracker = costTracker || createTestCostTracker();
    const agent = new CriticAgent(tracker);

    // Override internal dependencies
    (agent as any).openai = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    return agent;
  }
}

// Helper to create a DigestProcessor with mocked agents
export function createTestDigestProcessor(storage: any, logger: any) {
  const DigestProcessor = require("../digest-processor").DigestProcessor;

  const processor = new DigestProcessor({
    storage,
    logger,
    platform: "test",
  });

  // Replace agent instances with test versions
  const costTracker = createTestCostTracker();

  processor.emailFetcher = TestAgentFactory.createEmailFetcherAgent(costTracker);
  processor.classifier = TestAgentFactory.createClassifierAgent(costTracker);
  processor.contentExtractor = TestAgentFactory.createContentExtractorAgent(costTracker);
  processor.researcher = TestAgentFactory.createResearchAgent(costTracker);
  processor.analyst = TestAgentFactory.createAnalysisAgent(costTracker);
  processor.critic = TestAgentFactory.createCriticAgent(costTracker);
  processor.costTracker = costTracker;

  // Set up batchOperations
  processor.batchOperations = {
    batchMarkReadAndArchive: vi.fn().mockResolvedValue(undefined),
    archiveEmails: vi.fn().mockResolvedValue(undefined),
  };

  return processor;
}
