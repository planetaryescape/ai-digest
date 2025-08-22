import type { ILogger } from "../interfaces/logger";

/**
 * AWS CloudWatch logger implementation
 * @deprecated Use PinoLoggerAdapter from '../logger' instead - it provides better CloudWatch integration
 */
export class CloudWatchLogger implements ILogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, ...args: unknown[]): void {
    // biome-ignore lint/suspicious/noConsole: CloudWatch logger needs console for Lambda
    console.log(`[${this.context}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    // biome-ignore lint/suspicious/noConsole: CloudWatch logger needs console for Lambda
    console.warn(`[${this.context}] WARN:`, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    // biome-ignore lint/suspicious/noConsole: CloudWatch logger needs console for Lambda
    console.error(`[${this.context}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    // biome-ignore lint/suspicious/noConsole: CloudWatch logger needs console for Lambda
    console.debug(`[${this.context}] DEBUG:`, message, ...args);
  }
}
