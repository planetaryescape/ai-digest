import type { HttpRequest, InvocationContext, Timer } from "@azure/functions";
import type { DigestResult } from "../../core/digest-processor";
import type { IPlatformAdapter } from "./IPlatformAdapter";
import type { UnifiedContext, UnifiedLogger, UnifiedRequest } from "./types";

/**
 * Azure Functions platform adapter
 */
export class AzurePlatformAdapter implements IPlatformAdapter {
  parseRequest(event: Timer | HttpRequest, context: InvocationContext): UnifiedRequest {
    const isTimer = this.isTimerTrigger(event);

    if (isTimer) {
      return {
        type: "timer",
        source: "azure-timer",
        invocationId: context.invocationId,
        timestamp: new Date(),
        cleanup: false,
      };
    }

    const httpRequest = event as HttpRequest;
    return {
      type: "http",
      method: httpRequest.method,
      path: httpRequest.url,
      query: Object.fromEntries(httpRequest.query.entries()),
      body: httpRequest.body,
      headers: Object.fromEntries(httpRequest.headers.entries()),
      cleanup: this.isCleanupMode(event),
      invocationId: context.invocationId,
      timestamp: new Date(),
    };
  }

  createContext(context: InvocationContext): UnifiedContext {
    const logger: UnifiedLogger = {
      info: (message: string, ...args: any[]) => context.info(message, ...args),
      warn: (message: string, ...args: any[]) => context.warn(message, ...args),
      error: (message: string, ...args: any[]) => context.error(message, ...args),
      debug: (message: string, ...args: any[]) => context.debug(message, ...args),
    };

    return {
      functionName: context.functionName,
      invocationId: context.invocationId,
      logger,
    };
  }

  formatResponse(result: DigestResult): any {
    return {
      status: result.success ? 200 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: result.success,
        message: result.message,
        details: {
          emailsFound: result.emailsFound,
          emailsProcessed: result.emailsProcessed,
          digestSent: result.success && result.emailsProcessed > 0,
          error: result.error,
        },
        timestamp: formatISO(new Date()),
      }),
    };
  }

  formatError(error: Error, context: UnifiedContext): any {
    const isCriticalError =
      error.message.includes("Email send failed") ||
      error.message.includes("Summary generation failed");

    return {
      status: isCriticalError ? 500 : 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: error.message,
        severity: isCriticalError ? "critical" : "warning",
        timestamp: formatISO(new Date()),
        invocationId: context.invocationId,
      }),
    };
  }

  isTimerTrigger(event: any): boolean {
    return event && "isPastDue" in event;
  }

  isCleanupMode(event: any): boolean {
    if (this.isTimerTrigger(event)) {
      return false;
    }

    const httpRequest = event as HttpRequest;
    const query = Object.fromEntries(httpRequest.query.entries());

    if (query.cleanup === "true") {
      return true;
    }

    if (httpRequest.body) {
      try {
        const body =
          typeof httpRequest.body === "string" ? JSON.parse(httpRequest.body) : httpRequest.body;
        return body.cleanup === true;
      } catch {
        return false;
      }
    }

    return false;
  }
}
