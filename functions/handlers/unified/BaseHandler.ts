import type { DigestResult } from "../../core/digest-processor";
import { DigestProcessor } from "../../core/digest-processor";
import type { ILogger } from "../../lib/interfaces/logger";
import type { IStorageClient } from "../../lib/interfaces/storage";
import { getMetrics } from "../../lib/metrics";
import type { IPlatformAdapter } from "./IPlatformAdapter";
import type { UnifiedContext, UnifiedRequest } from "./types";

/**
 * Base handler for unified cloud function processing
 */
export abstract class BaseHandler {
  protected abstract getPlatformAdapter(): IPlatformAdapter;
  protected abstract getStorage(): IStorageClient;

  /**
   * Unified handler entry point
   */
  async handle(event: any, context: any): Promise<any> {
    const adapter = this.getPlatformAdapter();
    const request = adapter.parseRequest(event, context);
    const unifiedContext = adapter.createContext(context);

    try {
      // Log request
      unifiedContext.logger.info(`Function invoked - ${unifiedContext.invocationId}`, {
        type: request.type,
        cleanup: request.cleanup,
        functionName: unifiedContext.functionName,
      });

      // Process request
      const result = await this.processRequest(request, unifiedContext);

      // Log success
      unifiedContext.logger.info("Request processed successfully", {
        emailsFound: result.emailsFound,
        emailsProcessed: result.emailsProcessed,
      });

      // Format and return response
      return adapter.formatResponse(result);
    } catch (error) {
      // Log error
      unifiedContext.logger.error("Request processing failed", error);

      // Format and return error response
      if (error instanceof Error) {
        return adapter.formatError(error, unifiedContext);
      }

      return adapter.formatError(new Error("An unknown error occurred"), unifiedContext);
    }
  }

  /**
   * Process the unified request
   */
  protected async processRequest(
    request: UnifiedRequest,
    context: UnifiedContext
  ): Promise<DigestResult> {
    const storage = this.getStorage();
    const logger = this.createLogger(context);

    const processor = new DigestProcessor({
      storage,
      logger,
      platform: this.getPlatformName(),
    });

    // Track metrics
    const timer = Date.now();

    try {
      let result: DigestResult;

      if (request.cleanup) {
        context.logger.info("Processing in cleanup mode");
        result = await processor.processAllEmails();
      } else {
        context.logger.info("Processing weekly digest");
        result = await processor.processWeeklyDigest();
      }

      // Record metrics
      const metricsCollector = getMetrics();
      metricsCollector.increment("digest.processed", {
        success: result.success ? "true" : "false",
        mode: request.cleanup ? "cleanup" : "weekly",
        platform: this.getPlatformName(),
      });

      metricsCollector.gauge("digest.emails_found", result.emailsFound);
      metricsCollector.gauge("digest.emails_processed", result.emailsProcessed);
      metricsCollector.gauge("digest.duration_ms", Date.now() - timer);

      return {
        ...result,
        invocationId: context.invocationId,
      };
    } catch (error) {
      // Record error metrics
      getMetrics().increment("digest.errors", {
        platform: this.getPlatformName(),
        mode: request.cleanup ? "cleanup" : "weekly",
      });

      throw error;
    }
  }

  /**
   * Create logger instance from unified context
   */
  protected createLogger(context: UnifiedContext): ILogger {
    return {
      info: (message: string, ...args: unknown[]) => {
        context.logger.info(`[${context.functionName}] ${message}`, ...args);
      },
      warn: (message: string, ...args: unknown[]) => {
        context.logger.warn(`[${context.functionName}] ${message}`, ...args);
      },
      error: (message: string, ...args: unknown[]) => {
        context.logger.error(`[${context.functionName}] ${message}`, ...args);
      },
      debug: (message: string, ...args: unknown[]) => {
        context.logger.debug(`[${context.functionName}] ${message}`, ...args);
      },
    };
  }

  /**
   * Get platform name for metrics
   */
  protected abstract getPlatformName(): string;

  /**
   * Validate request before processing
   */
  protected validateRequest(request: UnifiedRequest): void {
    if (!request.invocationId) {
      throw new Error("Missing invocation ID");
    }

    if (request.type === "http" && !request.method) {
      throw new Error("Missing HTTP method");
    }
  }

  /**
   * Handle async invocation for cleanup mode (AWS specific)
   */
  protected async handleAsyncInvocation?(request: UnifiedRequest): Promise<void>;
}
