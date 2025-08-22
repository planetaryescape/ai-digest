import { createLogger } from "./logger";

const log = createLogger("metrics");

export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram",
  TIMER = "timer",
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

export interface MetricsCollector {
  increment(name: string, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  timer<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T>;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  flush(): Promise<void>;
}

class InMemoryMetricsCollector implements MetricsCollector {
  private metrics: Metric[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 100;
  private readonly flushIntervalMs = 30000; // 30 seconds

  constructor() {
    this.startAutoFlush();
  }

  increment(name: string, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      type: MetricType.COUNTER,
      value: 1,
      tags,
      timestamp: new Date(),
    });
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      type: MetricType.GAUGE,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  async timer<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.histogram(`${name}.duration`, duration, { ...tags, status: "success" });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.histogram(`${name}.duration`, duration, { ...tags, status: "error" });
      throw error;
    }
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.addMetric({
      name,
      type: MetricType.HISTOGRAM,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  private addMetric(metric: Metric): void {
    this.metrics.push(metric);

    if (this.metrics.length >= this.maxBatchSize) {
      this.flush().catch((err) => {
        log.error({ err }, "Failed to flush metrics");
      });
    }
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToFlush = [...this.metrics];
    this.metrics = [];

    try {
      await this.sendMetrics(metricsToFlush);
    } catch (error) {
      log.error({ error, count: metricsToFlush.length }, "Failed to send metrics");
      // Re-add metrics if send failed (with limit to prevent memory issues)
      if (this.metrics.length < this.maxBatchSize * 2) {
        this.metrics.unshift(...metricsToFlush);
      }
    }
  }

  protected async sendMetrics(metrics: Metric[]): Promise<void> {
    // Group metrics by type for efficient logging
    const grouped = metrics.reduce(
      (acc, metric) => {
        const key = `${metric.type}:${metric.name}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(metric);
        return acc;
      },
      {} as Record<string, Metric[]>
    );

    // Log aggregated metrics
    for (const [key, groupedMetrics] of Object.entries(grouped)) {
      const [type, name] = key.split(":");

      if (type === MetricType.COUNTER) {
        const sum = groupedMetrics.reduce((acc, m) => acc + m.value, 0);
        log.info({ metric: name, type, value: sum, count: groupedMetrics.length }, "Metric");
      } else if (type === MetricType.HISTOGRAM || type === MetricType.TIMER) {
        const values = groupedMetrics.map((m) => m.value);
        const stats = this.calculateStats(values);
        log.info({ metric: name, type, stats, count: groupedMetrics.length }, "Metric");
      } else if (type === MetricType.GAUGE) {
        const latest = groupedMetrics[groupedMetrics.length - 1];
        log.info({ metric: name, type, value: latest.value, tags: latest.tags }, "Metric");
      }
    }

    // In production, this would send to a metrics service like CloudWatch, Datadog, etc.
    if (process.env.METRICS_ENDPOINT) {
      // await this.sendToMetricsService(metrics);
    }
  }

  private calculateStats(values: number[]): Record<string, number> {
    if (values.length === 0) {
      return {};
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: values.length,
    };
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => {
        log.error({ err }, "Auto-flush failed");
      });
    }, this.flushIntervalMs);
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush().catch(() => {}); // Best effort final flush
  }
}

// CloudWatch Metrics Collector
class CloudWatchMetricsCollector extends InMemoryMetricsCollector {
  private namespace: string;

  constructor(namespace = "AIDigest") {
    super();
    this.namespace = namespace;
  }

  protected async sendMetrics(metrics: Metric[]): Promise<void> {
    // In production, this would use AWS SDK to send to CloudWatch
    // For now, just log them
    await super.sendMetrics(metrics);

    if (process.env.AWS_REGION) {
      // Would implement CloudWatch PutMetricData here
      log.info({ namespace: this.namespace, count: metrics.length }, "Would send to CloudWatch");
    }
  }
}

// Factory function to create appropriate metrics collector
export function createMetricsCollector(): MetricsCollector {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return new CloudWatchMetricsCollector();
  }

  return new InMemoryMetricsCollector();
}

// Global metrics instance
let globalMetrics: MetricsCollector | null = null;

export function getMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = createMetricsCollector();
  }
  return globalMetrics;
}

// Helper functions for common metrics
export const metrics = {
  emailsProcessed: (count: number, tags?: Record<string, string>) => {
    getMetrics().increment("emails.processed", { ...tags, count: count.toString() });
  },

  apiCall: async function<T>(service: string, operation: string, fn: () => Promise<T>): Promise<T> {
    return getMetrics().timer(`api.${service}.${operation}`, fn, { service, operation });
  },

  digestGenerated: (emailCount: number, duration: number) => {
    getMetrics().increment("digest.generated");
    getMetrics().histogram("digest.email_count", emailCount);
    getMetrics().histogram("digest.duration", duration);
  },

  error: (error: string, tags?: Record<string, string>) => {
    getMetrics().increment("errors", { ...tags, error });
  },

  storageOperation: async function<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    return getMetrics().timer(`storage.${operation}`, fn);
  },

  lambdaInvocation: (functionName: string, isAsync: boolean) => {
    getMetrics().increment("lambda.invocations", {
      function: functionName,
      async: isAsync.toString(),
    });
  },

  cleanupMode: (batchNumber: number, emailCount: number) => {
    getMetrics().gauge("cleanup.batch_number", batchNumber);
    getMetrics().histogram("cleanup.batch_size", emailCount);
  },
};

// Ensure metrics are flushed on process exit
if (typeof process !== "undefined") {
  process.on("beforeExit", () => {
    if (globalMetrics) {
      globalMetrics.flush().catch(() => {});
    }
  });
}
