import { metrics } from "../metrics";

/**
 * Decorator to track metrics for method execution
 */
export function TrackMetrics(metricName: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - timer;

        // Track success metrics
        metrics.increment(`${metricName}.success`);
        metrics.gauge(`${metricName}.duration_ms`, duration);

        return result;
      } catch (error) {
        const duration = Date.now() - timer;

        // Track failure metrics
        metrics.increment(`${metricName}.failure`);
        metrics.gauge(`${metricName}.duration_ms`, duration);

        // Track error type
        if (error instanceof Error) {
          metrics.increment(`${metricName}.error`, {
            type: error.constructor.name,
          });
        }

        throw error;
      }
    };

    return descriptor;
  };
}
