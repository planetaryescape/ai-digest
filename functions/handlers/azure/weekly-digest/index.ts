import type { HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { DigestProcessor } from "../../../core/digest-processor";
import { AzureStorageClient } from "../../../lib/azure/storage";
import type { ILogger } from "../../../lib/interfaces/logger";

/**
 * Azure Functions logger implementation
 */
class AzureFunctionsLogger implements ILogger {
  private context: InvocationContext;
  private module: string;

  constructor(context: InvocationContext, module: string) {
    this.context = context;
    this.module = module;
  }

  info(message: string, ...args: unknown[]): void {
    this.context.info(`[${this.module}] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.context.warn(`[${this.module}] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.context.error(`[${this.module}] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.context.debug(`[${this.module}] ${message}`, ...args);
  }
}

/**
 * Azure Function handler for weekly digest
 * Can be triggered by timer or HTTP
 */
export default async function weeklyDigest(
  myTimer: Timer | HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit | undefined> {
  const logger = new AzureFunctionsLogger(context, "weekly-digest");
  logger.info(`Function invoked - ${context.invocationId}`);
  
  // Check if this is a timer trigger
  const isTimerTrigger = myTimer && 'isPastDue' in myTimer;
  
  if (isTimerTrigger && myTimer.isPastDue) {
    logger.warn("Timer is past due!");
  }

  const storage = new AzureStorageClient();
  const processor = new DigestProcessor({ storage, logger });

  try {
    const result = await processor.processWeeklyDigest();
    
    // Return HTTP response for HTTP triggers
    if (!isTimerTrigger) {
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
          timestamp: new Date().toISOString(),
          invocationId: context.invocationId,
        }),
      };
    }
    
    // For timer triggers, just log the result
    logger.info("Digest processing completed", result);
    
    // Throw error for timer triggers to mark as failed
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
  } catch (error) {
    logger.error("Failed to process digest", error);
    
    // Return error response for HTTP triggers
    if (!isTimerTrigger) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred processing the digest";
      const isCriticalError = errorMessage.includes("Email send failed") || 
                             errorMessage.includes("Summary generation failed");
      
      return {
        status: isCriticalError ? 500 : 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: errorMessage,
          severity: isCriticalError ? "critical" : "warning",
          timestamp: new Date().toISOString(),
          invocationId: context.invocationId,
        }),
      };
    }
    
    // Re-throw for timer triggers
    throw error;
  }
}