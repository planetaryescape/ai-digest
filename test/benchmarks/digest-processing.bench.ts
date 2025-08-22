import { BenchmarkRunner } from "./benchmark-runner";
import { DigestProcessor } from "../../functions/core/digest-processor";
import { CostTracker } from "../../functions/lib/cost-tracker";
import type { ILogger } from "../../functions/lib/interfaces/logger";
import type { IStorageClient } from "../../functions/lib/interfaces/storage";

// Mock implementations for benchmarking
class MockLogger implements ILogger {
  debug() {}
  info() {}
  warn() {}
  error() {}
}

class MockStorage implements IStorageClient {
  async hasProcessedEmail(): Promise<boolean> {
    return false;
  }
  async markEmailAsProcessed(): Promise<void> {}
  async isKnownAISender(): Promise<boolean> {
    return Math.random() > 0.5;
  }
  async addKnownAISender(): Promise<void> {}
  async getKnownAISenders(): Promise<string[]> {
    return ["ai@newsletter.com", "ml@digest.com"];
  }
  async storeDigestMetadata(): Promise<void> {}
  async getDigestHistory(): Promise<any[]> {
    return [];
  }
}

function generateMockEmails(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    threadId: `thread-${i}`,
    subject: `AI Newsletter ${i}`,
    from: `sender${i}@example.com`,
    body: `Content about AI and machine learning ${i}`.repeat(10),
    snippet: `Snippet ${i}`,
    receivedDate: new Date(Date.now() - i * 60000).toISOString(),
    labelIds: ["INBOX", "UNREAD"],
  }));
}

async function runDigestBenchmarks() {
  const runner = new BenchmarkRunner("digest-processing");

  // Setup
  const logger = new MockLogger();
  const storage = new MockStorage();
  const costTracker = new CostTracker(1.0);

  // Benchmark: Small batch processing (10 emails)
  runner.add("Process 10 emails", async () => {
    const processor = new DigestProcessor(logger, storage, costTracker);
    const emails = generateMockEmails(10);

    // Mock the processing without actual API calls
    for (const email of emails) {
      await storage.markEmailAsProcessed(email.id);
    }
  });

  // Benchmark: Medium batch processing (50 emails)
  runner.add("Process 50 emails", async () => {
    const processor = new DigestProcessor(logger, storage, costTracker);
    const emails = generateMockEmails(50);

    for (const email of emails) {
      await storage.markEmailAsProcessed(email.id);
    }
  });

  // Benchmark: Large batch processing (100 emails)
  runner.add("Process 100 emails", async () => {
    const processor = new DigestProcessor(logger, storage, costTracker);
    const emails = generateMockEmails(100);

    for (const email of emails) {
      await storage.markEmailAsProcessed(email.id);
    }
  });

  // Benchmark: Email deduplication
  runner.add("Deduplicate 100 emails", async () => {
    const emails = generateMockEmails(100);
    const seen = new Set<string>();

    const unique = emails.filter((email) => {
      if (seen.has(email.id)) return false;
      seen.add(email.id);
      return true;
    });
  });

  // Benchmark: Email filtering
  runner.add("Filter AI emails from 100", async () => {
    const emails = generateMockEmails(100);
    const aiKeywords = ["AI", "machine learning", "GPT", "neural", "model"];

    const filtered = emails.filter((email) =>
      aiKeywords.some(
        (keyword) =>
          email.subject.toLowerCase().includes(keyword.toLowerCase()) ||
          email.body.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  });

  // Benchmark: Batch splitting
  runner.add("Split 500 emails into batches", async () => {
    const emails = generateMockEmails(500);
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }
  });

  // Benchmark: Storage operations
  runner.add("Storage: Check 100 processed emails", async () => {
    const storage = new MockStorage();
    const emailIds = Array.from({ length: 100 }, (_, i) => `msg-${i}`);

    for (const id of emailIds) {
      await storage.hasProcessedEmail(id);
    }
  });

  runner.add("Storage: Mark 100 emails processed", async () => {
    const storage = new MockStorage();
    const emailIds = Array.from({ length: 100 }, (_, i) => `msg-${i}`);

    for (const id of emailIds) {
      await storage.markEmailAsProcessed(id);
    }
  });

  // Benchmark: Known sender checks
  runner.add("Check 50 known AI senders", async () => {
    const storage = new MockStorage();
    const senders = Array.from({ length: 50 }, (_, i) => `sender${i}@example.com`);

    for (const sender of senders) {
      await storage.isKnownAISender(sender);
    }
  });

  // Benchmark: Memory usage for large email sets
  runner.add("Memory: Store 1000 emails", async () => {
    const emails = generateMockEmails(1000);
    const map = new Map();

    for (const email of emails) {
      map.set(email.id, email);
    }
  });

  // Run benchmarks
  await runner.runWithComparison();

  // Measure memory usage for different email volumes
  console.log("\n📈 Memory Usage Analysis:");
  console.log("=".repeat(80));

  const volumes = [10, 50, 100, 500, 1000];
  for (const volume of volumes) {
    const memory = await runner.measureMemory(async () => {
      const emails = generateMockEmails(volume);
      const processor = new DigestProcessor(logger, storage, costTracker);
      // Simulate holding emails in memory
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    console.log(`  ${volume} emails: ${memory.toFixed(2)} MB`);
  }
}

// Run if called directly
if (require.main === module) {
  runDigestBenchmarks().catch(console.error);
}

export { runDigestBenchmarks };
