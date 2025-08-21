import { createLogger, Logger } from "./logger";

export interface RequestContext {
  requestId: string;
  userId?: string;
  logger: Logger;
}

export function withErrorHandling<T>(
  fn: (context: RequestContext, ...args: any[]) => Promise<T>
) {
  return async (context: RequestContext, ...args: any[]): Promise<T> => {
    try {
      return await fn(context, ...args);
    } catch (error) {
      context.logger.error({ error }, "Request failed");
      throw error;
    }
  };
}

export function withLogging<T>(
  fn: (context: RequestContext, ...args: any[]) => Promise<T>
) {
  return async (context: RequestContext, ...args: any[]): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await fn(context, ...args);
      context.logger.info(
        { duration: Date.now() - startTime },
        "Request completed"
      );
      return result;
    } catch (error) {
      context.logger.error(
        { error, duration: Date.now() - startTime },
        "Request failed"
      );
      throw error;
    }
  };
}