import pino from "pino";
import type { ILogger } from "./interfaces/logger";

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const isAzure = !!process.env.AZURE_FUNCTIONS_ENVIRONMENT;
const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const level = process.env.LOG_LEVEL || (isDev ? "debug" : "info");

const baseLogger = pino({
  level: isTest ? "silent" : level,
  transport:
    isDev && !isLambda && !isAzure && !isTest
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: isLambda
    ? {
        environment: "lambda",
        function: process.env.AWS_LAMBDA_FUNCTION_NAME,
        region: process.env.AWS_REGION,
        memorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
      }
    : isAzure
      ? {
          environment: "azure",
          function: process.env.AZURE_FUNCTIONS_FUNCTION_NAME,
          region: process.env.AZURE_REGION,
        }
      : {
          environment: isDev ? "development" : "production",
        },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Creates a child logger with a specific context
 * @param context - The context/module name for the logger
 * @returns A pino logger instance with the specified context
 */
export function createLogger(context: string): pino.Logger {
  return baseLogger.child({ context });
}

/**
 * Pino logger adapter that implements ILogger interface
 * for backward compatibility with existing code
 */
export class PinoLoggerAdapter implements ILogger {
  private logger: pino.Logger;

  constructor(context: string) {
    this.logger = createLogger(context);
  }

  info(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.info({ data: args }, message);
    } else {
      this.logger.info(message);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.warn({ data: args }, message);
    } else {
      this.logger.warn(message);
    }
  }

  error(message: string, ...args: unknown[]): void {
    const error = args.find((arg) => arg instanceof Error);
    const otherArgs = args.filter((arg) => !(arg instanceof Error));

    if (error) {
      this.logger.error(
        { err: error, data: otherArgs.length > 0 ? otherArgs : undefined },
        message
      );
    } else if (args.length > 0) {
      this.logger.error({ data: args }, message);
    } else {
      this.logger.error(message);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (args.length > 0) {
      this.logger.debug({ data: args }, message);
    } else {
      this.logger.debug(message);
    }
  }
}

// Export Logger class as alias for PinoLoggerAdapter
export const Logger = PinoLoggerAdapter;

// Timer functionality
export function createTimer() {
  const start = Date.now();
  return () => Date.now() - start;
}

export default baseLogger;
