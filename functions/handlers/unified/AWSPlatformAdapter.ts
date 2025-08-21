import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";
import type { DigestResult } from "../../core/digest-processor";
import type { IPlatformAdapter } from "./IPlatformAdapter";
import type { UnifiedContext, UnifiedLogger, UnifiedRequest, UnifiedResponse } from "./types";

/**
 * AWS Lambda platform adapter
 */
export class AWSPlatformAdapter implements IPlatformAdapter {
  parseRequest(event: ScheduledEvent | APIGatewayProxyEvent, context: Context): UnifiedRequest {
    const isScheduled = this.isTimerTrigger(event);

    if (isScheduled) {
      const scheduledEvent = event as ScheduledEvent;
      return {
        type: "timer",
        source: scheduledEvent.source || "aws.events",
        invocationId: context.awsRequestId,
        timestamp: new Date(scheduledEvent.time),
        cleanup: false,
      };
    }

    const apiEvent = event as APIGatewayProxyEvent;
    const body = this.parseBody(apiEvent.body);
    const query = apiEvent.queryStringParameters || {};

    // Extract batchSize from query params or body
    const batchSize = query.batchSize
      ? Number.parseInt(query.batchSize)
      : body?.batchSize
        ? Number.parseInt(body.batchSize)
        : undefined;

    return {
      type: "http",
      method: apiEvent.httpMethod,
      path: apiEvent.path,
      query: query as Record<string, string>,
      body: body,
      headers: (apiEvent.headers || {}) as Record<string, string>,
      cleanup: this.isCleanupMode(event),
      batchSize: batchSize,
      invocationId: context.awsRequestId,
      timestamp: new Date(),
      // Historical mode fields
      mode: body?.mode || (this.isCleanupMode(event) ? "cleanup" : "weekly"),
      startDate: body?.startDate,
      endDate: body?.endDate,
      includeArchived: body?.includeArchived,
    };
  }

  createContext(context: Context): UnifiedContext {
    const logger: UnifiedLogger = {
      info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
      debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
    };

    return {
      functionName: context.functionName,
      invocationId: context.awsRequestId,
      logger,
    };
  }

  formatResponse(result: DigestResult): APIGatewayProxyResult {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];
    const corsOrigin = allowedOrigins.includes("*") ? "*" : allowedOrigins[0];

    return {
      statusCode: result.success ? 200 : 500,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": result.invocationId || "",
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        success: result.success,
        message: result.message,
        details: {
          emailsFound: result.emailsFound,
          emailsProcessed: result.emailsProcessed,
          digestSent: result.success && result.emailsProcessed > 0,
          error: result.error,
        },
        timestamp: new Date().toISOString(),
      }),
    };
  }

  formatError(error: Error, context: UnifiedContext): APIGatewayProxyResult {
    const isCriticalError =
      error.message.includes("Email send failed") ||
      error.message.includes("Summary generation failed");

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];
    const corsOrigin = allowedOrigins.includes("*") ? "*" : allowedOrigins[0];

    return {
      statusCode: isCriticalError ? 500 : 200,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": context.invocationId,
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Credentials": "true",
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        severity: isCriticalError ? "critical" : "warning",
        timestamp: new Date().toISOString(),
        invocationId: context.invocationId,
      }),
    };
  }

  isTimerTrigger(event: any): boolean {
    return event && event.source === "aws.events" && event["detail-type"] === "Scheduled Event";
  }

  isCleanupMode(event: any): boolean {
    if (this.isTimerTrigger(event)) {
      return false;
    }

    const apiEvent = event as APIGatewayProxyEvent;

    // Check query parameters
    if (apiEvent.queryStringParameters?.cleanup === "true") {
      return true;
    }

    // Check body
    if (apiEvent.body) {
      const body = this.parseBody(apiEvent.body);
      return body?.cleanup === true;
    }

    return false;
  }

  private parseBody(body: string | null): any {
    if (!body) return null;

    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
}
