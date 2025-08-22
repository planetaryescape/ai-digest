import { Bench } from "tinybench";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface BenchmarkResult {
  name: string;
  ops: number;
  margin: number;
  samples: number;
  mean: number;
  median: number;
  p99: number;
  memoryUsed?: number;
}

export interface BenchmarkBaseline {
  timestamp: string;
  results: BenchmarkResult[];
  systemInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
    memoryTotal: number;
  };
}

export class BenchmarkRunner {
  private bench: Bench;
  private baselinePath: string;

  constructor(name: string) {
    this.bench = new Bench({
      time: 1000,
      iterations: 10,
      warmupTime: 100,
      warmupIterations: 2,
    });
    this.baselinePath = join(__dirname, "baselines", `${name}.json`);
  }

  add(name: string, fn: () => void | Promise<void>) {
    this.bench.add(name, fn);
  }

  async run(): Promise<BenchmarkResult[]> {
    await this.bench.run();

    const results: BenchmarkResult[] = this.bench.tasks.map((task) => ({
      name: task.name,
      ops: task.result?.hz || 0,
      margin: task.result?.rme || 0,
      samples: task.result?.samples.length || 0,
      mean: task.result?.mean || 0,
      median: task.result?.p50 || 0,
      p99: task.result?.p99 || 0,
    }));

    return results;
  }

  saveBaseline(results: BenchmarkResult[]) {
    const baseline: BenchmarkBaseline = {
      timestamp: new Date().toISOString(),
      results,
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memoryTotal: process.memoryUsage().heapTotal,
      },
    };

    const dir = join(__dirname, "baselines");
    if (!existsSync(dir)) {
      require("fs").mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.baselinePath, JSON.stringify(baseline, null, 2));
    console.log(`Baseline saved to ${this.baselinePath}`);
  }

  loadBaseline(): BenchmarkBaseline | null {
    if (!existsSync(this.baselinePath)) {
      return null;
    }

    try {
      const content = readFileSync(this.baselinePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Failed to load baseline:", error);
      return null;
    }
  }

  compareWithBaseline(
    current: BenchmarkResult[],
    threshold = 0.1
  ): { regressions: string[]; improvements: string[] } {
    const baseline = this.loadBaseline();
    if (!baseline) {
      console.log("No baseline found for comparison");
      return { regressions: [], improvements: [] };
    }

    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const currentResult of current) {
      const baselineResult = baseline.results.find((r) => r.name === currentResult.name);

      if (!baselineResult) continue;

      const percentChange = (currentResult.ops - baselineResult.ops) / baselineResult.ops;

      if (percentChange < -threshold) {
        regressions.push(
          `${currentResult.name}: ${(percentChange * 100).toFixed(1)}% slower ` +
            `(${currentResult.ops.toFixed(1)} ops/s vs ${baselineResult.ops.toFixed(1)} ops/s)`
        );
      } else if (percentChange > threshold) {
        improvements.push(
          `${currentResult.name}: ${(percentChange * 100).toFixed(1)}% faster ` +
            `(${currentResult.ops.toFixed(1)} ops/s vs ${baselineResult.ops.toFixed(1)} ops/s)`
        );
      }
    }

    return { regressions, improvements };
  }

  async measureMemory(fn: () => Promise<void>): Promise<number> {
    if (global.gc) {
      global.gc();
    }

    const memBefore = process.memoryUsage().heapUsed;
    await fn();
    const memAfter = process.memoryUsage().heapUsed;

    if (global.gc) {
      global.gc();
    }

    return (memAfter - memBefore) / 1024 / 1024; // MB
  }

  printResults(results: BenchmarkResult[]) {
    console.log("\n📊 Benchmark Results:");
    console.log("=".repeat(80));

    const sorted = [...results].sort((a, b) => b.ops - a.ops);
    const fastest = sorted[0];

    for (const result of sorted) {
      const relative = fastest.ops / result.ops;
      const status = relative === 1 ? "🥇" : relative > 0.9 ? "🥈" : "🥉";

      console.log(
        `${status} ${result.name.padEnd(40)} ` +
          `${result.ops.toFixed(2).padStart(10)} ops/s ` +
          `(±${result.margin.toFixed(2)}%) ` +
          `${relative === 1 ? "(fastest)" : `(${relative.toFixed(2)}x slower)`}`
      );
    }

    console.log("=".repeat(80));
  }

  async runWithComparison(): Promise<void> {
    console.log("Running benchmarks...");
    const results = await this.run();

    this.printResults(results);

    const comparison = this.compareWithBaseline(results);

    if (comparison.regressions.length > 0) {
      console.log("\n⚠️  Performance Regressions Detected:");
      comparison.regressions.forEach((r) => console.log(`  - ${r}`));
    }

    if (comparison.improvements.length > 0) {
      console.log("\n✨ Performance Improvements:");
      comparison.improvements.forEach((i) => console.log(`  - ${i}`));
    }

    if (process.env.UPDATE_BASELINE === "true") {
      this.saveBaseline(results);
    }

    // Fail CI if regressions detected
    if (process.env.CI && comparison.regressions.length > 0) {
      process.exit(1);
    }
  }
}
