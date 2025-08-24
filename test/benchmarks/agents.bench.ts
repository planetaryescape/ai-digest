import { CostTracker } from "../../functions/lib/cost-tracker";
import { BenchmarkRunner } from "./benchmark-runner";

// Mock agent implementations for benchmarking
class MockAgent {
  constructor(protected costTracker: CostTracker) {}

  async process(data: any): Promise<any> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
    this.costTracker.addCost(0.001);
    return { processed: true };
  }
}

class MockEmailFetcherAgent extends MockAgent {
  async fetchEmails(count: number) {
    const emails = [];
    for (let i = 0; i < count; i++) {
      emails.push({
        id: `email-${i}`,
        subject: `Subject ${i}`,
        from: `sender${i}@example.com`,
      });
    }
    this.costTracker.addCost(0.0001 * count);
    return emails;
  }
}

class MockClassifierAgent extends MockAgent {
  async classifyBatch(emails: any[]) {
    const classified = emails.map((email) => ({
      ...email,
      isAI: Math.random() > 0.3,
      confidence: Math.random(),
    }));
    this.costTracker.addCost(0.002 * emails.length);
    return classified;
  }
}

class MockContentExtractorAgent extends MockAgent {
  async extractContent(url: string) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.costTracker.addCost(0.001);
    return {
      url,
      title: "Extracted Title",
      content: "Extracted content here...",
      links: ["link1", "link2"],
    };
  }
}

class MockResearchAgent extends MockAgent {
  async research(query: string) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.costTracker.addCost(0.003);
    return {
      query,
      results: [
        { title: "Result 1", snippet: "Snippet 1" },
        { title: "Result 2", snippet: "Snippet 2" },
      ],
    };
  }
}

class MockAnalysisAgent extends MockAgent {
  async analyze(content: any) {
    const words = JSON.stringify(content).length;
    await new Promise((resolve) => setTimeout(resolve, words / 100));
    this.costTracker.addCost(0.01);
    return {
      summary: "Analysis summary",
      insights: ["Insight 1", "Insight 2"],
      recommendations: ["Rec 1", "Rec 2"],
    };
  }
}

async function runAgentBenchmarks() {
  const runner = new BenchmarkRunner("agent-performance");

  // Setup
  const costTracker = new CostTracker(1.0);

  // Benchmark: Email fetching
  runner.add("EmailFetcher: Fetch 10 emails", async () => {
    const agent = new MockEmailFetcherAgent(costTracker);
    await agent.fetchEmails(10);
  });

  runner.add("EmailFetcher: Fetch 100 emails", async () => {
    const agent = new MockEmailFetcherAgent(costTracker);
    await agent.fetchEmails(100);
  });

  // Benchmark: Email classification
  runner.add("Classifier: Classify 10 emails", async () => {
    const agent = new MockClassifierAgent(costTracker);
    const emails = Array.from({ length: 10 }, (_, i) => ({
      id: `email-${i}`,
      subject: `Subject ${i}`,
    }));
    await agent.classifyBatch(emails);
  });

  runner.add("Classifier: Classify 50 emails", async () => {
    const agent = new MockClassifierAgent(costTracker);
    const emails = Array.from({ length: 50 }, (_, i) => ({
      id: `email-${i}`,
      subject: `Subject ${i}`,
    }));
    await agent.classifyBatch(emails);
  });

  // Benchmark: Content extraction
  runner.add("ContentExtractor: Extract 1 URL", async () => {
    const agent = new MockContentExtractorAgent(costTracker);
    await agent.extractContent("https://example.com/article");
  });

  runner.add("ContentExtractor: Extract 10 URLs parallel", async () => {
    const agent = new MockContentExtractorAgent(costTracker);
    const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/article${i}`);
    await Promise.all(urls.map((url) => agent.extractContent(url)));
  });

  // Benchmark: Research
  runner.add("Research: 1 query", async () => {
    const agent = new MockResearchAgent(costTracker);
    await agent.research("AI advancements 2024");
  });

  runner.add("Research: 5 queries parallel", async () => {
    const agent = new MockResearchAgent(costTracker);
    const queries = [
      "AI advancements",
      "Machine learning trends",
      "GPT updates",
      "Computer vision",
      "NLP breakthroughs",
    ];
    await Promise.all(queries.map((q) => agent.research(q)));
  });

  // Benchmark: Analysis
  runner.add("Analysis: Small content", async () => {
    const agent = new MockAnalysisAgent(costTracker);
    await agent.analyze({ text: "Small content to analyze" });
  });

  runner.add("Analysis: Large content", async () => {
    const agent = new MockAnalysisAgent(costTracker);
    const largeContent = {
      text: "Large content ".repeat(100),
      metadata: { source: "test", date: new Date() },
    };
    await agent.analyze(largeContent);
  });

  // Benchmark: Pipeline processing
  runner.add("Pipeline: Process 10 emails end-to-end", async () => {
    const fetcher = new MockEmailFetcherAgent(costTracker);
    const classifier = new MockClassifierAgent(costTracker);
    const extractor = new MockContentExtractorAgent(costTracker);
    const researcher = new MockResearchAgent(costTracker);
    const analyzer = new MockAnalysisAgent(costTracker);

    // Fetch
    const emails = await fetcher.fetchEmails(10);

    // Classify
    const classified = await classifier.classifyBatch(emails);

    // Extract AI emails
    const aiEmails = classified.filter((e) => e.isAI);

    // Extract content (parallel)
    const contents = await Promise.all(
      aiEmails.slice(0, 3).map((e) => extractor.extractContent(`https://example.com/${e.id}`))
    );

    // Research (parallel)
    const research = await Promise.all(contents.map((c) => researcher.research(c.title)));

    // Analyze
    await analyzer.analyze({ contents, research });
  });

  // Benchmark: Cost tracking
  runner.add("CostTracker: Track 1000 operations", () => {
    const tracker = new CostTracker(1.0);
    for (let i = 0; i < 1000; i++) {
      tracker.addCost(0.0001);
      tracker.checkLimit();
    }
  });

  // Run benchmarks
  await runner.runWithComparison();

  // Agent-specific metrics
  console.log("\n🤖 Agent Performance Metrics:");
  console.log("=".repeat(80));

  const agents = [
    { name: "EmailFetcher", ops: [10, 100, 500] },
    { name: "Classifier", ops: [10, 50, 100] },
    { name: "ContentExtractor", ops: [1, 5, 10] },
    { name: "Research", ops: [1, 3, 5] },
    { name: "Analysis", ops: [1, 5, 10] },
  ];

  for (const agent of agents) {
    console.log(`\n${agent.name}:`);
    for (const opCount of agent.ops) {
      const memory = await runner.measureMemory(async () => {
        const tracker = new CostTracker(1.0);
        const mockAgent = new MockAgent(tracker);

        for (let i = 0; i < opCount; i++) {
          await mockAgent.process({ data: i });
        }
      });

      console.log(`  ${opCount} operations: ${memory.toFixed(2)} MB`);
    }
  }
}

// Run if called directly
if (require.main === module) {
  runAgentBenchmarks().catch(console.error);
}

export { runAgentBenchmarks };
