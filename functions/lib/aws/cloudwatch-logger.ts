import type { ILogger } from "../interfaces/logger";

/**
 * AWS CloudWatch logger implementation
 */
export class CloudWatchLogger implements ILogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[${this.context}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[${this.context}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.debug(`[${this.context}] DEBUG:`, message, ...args);
  }
}
