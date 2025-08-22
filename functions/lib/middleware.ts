import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { createLogger, type Logger } from "./logger";

export interface RequestContext {
  requestId: string;
  userId?: string;
  logger: Logger;
}

export function compose(...middlewares: any[]) {
  return (handler: any) => {
    return middlewares.reduceRight((next, middleware) => middleware(next), handler);
  };
}

export function withCorrelationId(handler: any) {
  return async (event: APIGatewayProxyEvent, context: Context) => {
    const correlationId = event.headers?.["x-correlation-id"] || context.awsRequestId;
    return handler({ ...event, correlationId }, context);
  };
}

export function withLambdaLogging(handler: any) {
  return async (event: APIGatewayProxyEvent, context: Context) => {
    const logger = createLogger("lambda");
    logger.info({ event, context }, "Lambda invoked");
    try {
      const result = await handler(event, context);
      logger.info({ result }, "Lambda completed");
      return result;
    } catch (error) {
      logger.error({ error }, "Lambda failed");
      throw error;
    }
  };
}

export function withErrorHandling<T>(fn: (context: RequestContext, ...args: any[]) => Promise<T>) {
  return async (context: RequestContext, ...args: any[]): Promise<T> => {
    try {
      return await fn(context, ...args);
    } catch (error) {
      context.logger.error({ error }, "Request failed");
      throw error;
    }
  };
}

export function withLogging<T>(fn: (context: RequestContext, ...args: any[]) => Promise<T>) {
  return async (context: RequestContext, ...args: any[]): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await fn(context, ...args);
      context.logger.info({ duration: Date.now() - startTime }, "Request completed");
      return result;
    } catch (error) {
      context.logger.error({ error, duration: Date.now() - startTime }, "Request failed");
      throw error;
    }
  };
}
