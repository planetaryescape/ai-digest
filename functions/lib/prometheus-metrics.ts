import { Counter, Gauge, Histogram, Registry } from "prom-client";
import { createLogger } from "./logger";
import type { MetricsCollector } from "./metrics";

const log = createLogger("prometheus-metrics");

export class PrometheusMetricsCollector implements MetricsCollector {
  private readonly register: Registry;
  private readonly counters: Map<string, Counter<string>>;
  private readonly gauges: Map<string, Gauge<string>>;
  private readonly histograms: Map<string, Histogram<string>>;
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs = 30000;
  private readonly namespace: string;

  constructor(namespace = "ai_digest") {
    this.namespace = namespace;
    this.register = new Registry();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();

    this.register.setDefaultLabels({
      app: "ai-digest",
      environment: process.env.NODE_ENV || "development",
    });

    this.initializeMetrics();
    this.startAutoFlush();
  }

  private initializeMetrics(): void {
    this.counters.set(
      "emails_processed",
      new Counter({
        name: `${this.namespace}_emails_processed_total`,
        help: "Total number of emails processed",
        labelNames: ["status", "count"],
        registers: [this.register],
      })
    );

    this.counters.set(
      "digest_generated",
      new Counter({
        name: `${this.namespace}_digest_generated_total`,
        help: "Total number of digests generated",
        registers: [this.register],
      })
    );

    this.counters.set(
      "errors",
      new Counter({
        name: `${this.namespace}_errors_total`,
        help: "Total number of errors",
        labelNames: ["error", "type"],
        registers: [this.register],
      })
    );

    this.counters.set(
      "lambda_invocations",
      new Counter({
        name: `${this.namespace}_lambda_invocations_total`,
        help: "Total number of Lambda invocations",
        labelNames: ["function", "async"],
        registers: [this.register],
      })
    );

    this.histograms.set(
      "api_duration",
      new Histogram({
        name: `${this.namespace}_api_duration_seconds`,
        help: "API call duration in seconds",
        labelNames: ["service", "operation", "status"],
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: [this.register],
      })
    );

    this.histograms.set(
      "digest_duration",
      new Histogram({
        name: `${this.namespace}_digest_duration_milliseconds`,
        help: "Digest generation duration in milliseconds",
        buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
        registers: [this.register],
      })
    );

    this.histograms.set(
      "digest_email_count",
      new Histogram({
        name: `${this.namespace}_digest_email_count`,
        help: "Number of emails in each digest",
        buckets: [1, 5, 10, 25, 50, 100, 250, 500],
        registers: [this.register],
      })
    );

    this.histograms.set(
      "cleanup_batch_size",
      new Histogram({
        name: `${this.namespace}_cleanup_batch_size`,
        help: "Size of cleanup batches",
        buckets: [1, 5, 10, 25, 50, 100, 250, 500],
        registers: [this.register],
      })
    );

    this.histograms.set(
      "storage_duration",
      new Histogram({
        name: `${this.namespace}_storage_duration_seconds`,
        help: "Storage operation duration in seconds",
        labelNames: ["operation"],
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
        registers: [this.register],
      })
    );

    this.gauges.set(
      "cleanup_batch_number",
      new Gauge({
        name: `${this.namespace}_cleanup_batch_number`,
        help: "Current cleanup batch number",
        registers: [this.register],
      })
    );
  }

  private getOrCreateCounter(name: string, tags?: Record<string, string>): Counter<string> {
    const metricName = name.replace(/\./g, "_");
    if (!this.counters.has(metricName)) {
      const labelNames = tags ? Object.keys(tags) : [];
      const counter = new Counter({
        name: `${this.namespace}_${metricName}_total`,
        help: `Counter for ${name}`,
        labelNames,
        registers: [this.register],
      });
      this.counters.set(metricName, counter);
    }
    return this.counters.get(metricName)!;
  }

  private getOrCreateGauge(name: string, tags?: Record<string, string>): Gauge<string> {
    const metricName = name.replace(/\./g, "_");
    if (!this.gauges.has(metricName)) {
      const labelNames = tags ? Object.keys(tags) : [];
      const gauge = new Gauge({
        name: `${this.namespace}_${metricName}`,
        help: `Gauge for ${name}`,
        labelNames,
        registers: [this.register],
      });
      this.gauges.set(metricName, gauge);
    }
    return this.gauges.get(metricName)!;
  }

  private getOrCreateHistogram(name: string, tags?: Record<string, string>): Histogram<string> {
    const metricName = name.replace(/\./g, "_");
    if (!this.histograms.has(metricName)) {
      const labelNames = tags ? Object.keys(tags) : [];
      const histogram = new Histogram({
        name: `${this.namespace}_${metricName}`,
        help: `Histogram for ${name}`,
        labelNames,
        registers: [this.register],
      });
      this.histograms.set(metricName, histogram);
    }
    return this.histograms.get(metricName)!;
  }

  increment(name: string, tags?: Record<string, string>): void {
    try {
      const metricName = name.replace(/\./g, "_");

      if (name === "emails.processed" && tags?.count) {
        const counter = this.counters.get("emails_processed");
        if (counter) {
          counter.inc(
            { status: tags.status || "success", count: tags.count },
            Number.parseInt(tags.count)
          );
        }
      } else if (name === "digest.generated") {
        const counter = this.counters.get("digest_generated");
        if (counter) {
          counter.inc();
        }
      } else if (name === "errors") {
        const counter = this.counters.get("errors");
        if (counter) {
          counter.inc({ error: tags?.error || "unknown", type: tags?.type || "general" });
        }
      } else if (name === "lambda.invocations") {
        const counter = this.counters.get("lambda_invocations");
        if (counter) {
          counter.inc({ function: tags?.function || "unknown", async: tags?.async || "false" });
        }
      } else {
        const counter = this.getOrCreateCounter(name, tags);
        counter.inc(tags || {});
      }
    } catch (error) {
      log.error({ error, name, tags }, "Failed to increment metric");
    }
  }

  gauge(name: string, value: number, tags?: Record<string, string>): void {
    try {
      const metricName = name.replace(/\./g, "_");

      if (name === "cleanup.batch_number") {
        const gauge = this.gauges.get("cleanup_batch_number");
        if (gauge) {
          gauge.set(value);
        }
      } else {
        const gauge = this.getOrCreateGauge(name, tags);
        gauge.set(tags || {}, value);
      }
    } catch (error) {
      log.error({ error, name, value, tags }, "Failed to set gauge metric");
    }
  }

  histogram(name: string, value: number, tags?: Record<string, string>): void {
    try {
      const metricName = name.replace(/\./g, "_");

      if (name === "digest.email_count") {
        const histogram = this.histograms.get("digest_email_count");
        if (histogram) {
          histogram.observe(value);
        }
      } else if (name === "digest.duration") {
        const histogram = this.histograms.get("digest_duration");
        if (histogram) {
          histogram.observe(value);
        }
      } else if (name === "cleanup.batch_size") {
        const histogram = this.histograms.get("cleanup_batch_size");
        if (histogram) {
          histogram.observe(value);
        }
      } else if (name.includes(".duration") && tags?.service) {
        const histogram = this.histograms.get("api_duration");
        if (histogram) {
          histogram.observe(
            {
              service: tags.service,
              operation: tags.operation || "unknown",
              status: tags.status || "success",
            },
            value / 1000
          );
        }
      } else if (name.startsWith("storage.") && name.endsWith(".duration")) {
        const histogram = this.histograms.get("storage_duration");
        if (histogram) {
          const operation = name.replace("storage.", "").replace(".duration", "");
          histogram.observe({ operation }, value / 1000);
        }
      } else {
        const histogram = this.getOrCreateHistogram(name, tags);
        histogram.observe(tags || {}, value);
      }
    } catch (error) {
      log.error({ error, name, value, tags }, "Failed to record histogram metric");
    }
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

  async flush(): Promise<void> {
    try {
      const metrics = await this.register.metrics();

      if (process.env.METRICS_ENDPOINT) {
        await this.sendToEndpoint(metrics);
      } else {
        log.info({ metricsLength: metrics.length }, "Metrics collected (no endpoint configured)");
      }

      if (process.env.AWS_LAMBDA_FUNCTION_NAME && process.env.AWS_REGION) {
        await this.sendToCloudWatch();
      }
    } catch (error) {
      log.error({ error }, "Failed to flush metrics");
    }
  }

  private async sendToEndpoint(metrics: string): Promise<void> {
    if (!process.env.METRICS_ENDPOINT) {
      return;
    }

    try {
      const response = await fetch(process.env.METRICS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; version=0.0.4",
        },
        body: metrics,
      });

      if (!response.ok) {
        throw new Error(`Metrics endpoint returned ${response.status}`);
      }

      log.info("Metrics sent to endpoint successfully");
    } catch (error) {
      log.error(
        { error, endpoint: process.env.METRICS_ENDPOINT },
        "Failed to send metrics to endpoint"
      );
    }
  }

  private async sendToCloudWatch(): Promise<void> {
    try {
      const metrics = await this.register.getMetricsAsJSON();

      const cloudWatchMetrics = metrics.map((metric) => {
        const dimensions =
          metric.aggregator === "sum" || metric.aggregator === "average"
            ? [{ Name: "MetricName", Value: metric.name }]
            : [];

        return {
          MetricName: metric.name,
          Dimensions: dimensions,
          Timestamp: new Date(),
          Unit: metric.name.includes("duration") ? "Milliseconds" : "Count",
          Value: metric.values?.[0]?.value || 0,
        };
      });

      log.info(
        { namespace: "AIDigest", count: cloudWatchMetrics.length },
        "Would send metrics to CloudWatch"
      );
    } catch (error) {
      log.error({ error }, "Failed to prepare CloudWatch metrics");
    }
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
    this.flush().catch(() => {});
  }
}

export class CloudWatchPrometheusCollector extends PrometheusMetricsCollector {
  constructor() {
    super("ai_digest");
  }

  async flush(): Promise<void> {
    await super.flush();

    if (process.env.AWS_REGION && process.env.AWS_LAMBDA_FUNCTION_NAME) {
      log.info("CloudWatch metrics collection enabled for Lambda");
    }
  }
}
