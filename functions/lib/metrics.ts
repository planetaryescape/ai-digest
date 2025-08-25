import { PrometheusMetricsCollector, CloudWatchPrometheusCollector } from "./prometheus-metrics";

export interface MetricsCollector {
  increment(name: string, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  timer<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T>;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  flush(): Promise<void>;
}

// Factory function to create appropriate metrics collector
export function createMetricsCollector(): MetricsCollector {
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return new CloudWatchPrometheusCollector();
  }

  return new PrometheusMetricsCollector();
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

  apiCall: async <T>(service: string, operation: string, fn: () => Promise<T>): Promise<T> =>
    getMetrics().timer(`api.${service}.${operation}`, fn, { service, operation }),

  digestGenerated: (emailCount: number, duration: number) => {
    getMetrics().increment("digest.generated");
    getMetrics().histogram("digest.email_count", emailCount);
    getMetrics().histogram("digest.duration", duration);
  },

  error: (error: string, tags?: Record<string, string>) => {
    getMetrics().increment("errors", { ...tags, error });
  },

  storageOperation: async <T>(operation: string, fn: () => Promise<T>): Promise<T> =>
    getMetrics().timer(`storage.${operation}`, fn),

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
      if ("destroy" in globalMetrics && typeof globalMetrics.destroy === "function") {
        (globalMetrics as any).destroy();
      }
    }
  });
}
