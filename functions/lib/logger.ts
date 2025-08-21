interface LogLevel {
  error: number;
  warn: number;
  info: number;
  debug: number;
}

const LOG_LEVELS: LogLevel = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export interface Logger {
  error(data: any, message?: string): void;
  warn(data: any, message?: string): void;
  info(data: any, message?: string): void;
  debug(data: any, message?: string): void;
}

class SimpleLogger implements Logger {
  private context: string;
  private level: number;

  constructor(context: string) {
    this.context = context;
    this.level = LOG_LEVELS[process.env.LOG_LEVEL as keyof LogLevel] || LOG_LEVELS.info;
  }

  error(data: any, message?: string): void {
    if (this.level >= LOG_LEVELS.error) {
      this.log("ERROR", data, message);
    }
  }

  warn(data: any, message?: string): void {
    if (this.level >= LOG_LEVELS.warn) {
      this.log("WARN", data, message);
    }
  }

  info(data: any, message?: string): void {
    if (this.level >= LOG_LEVELS.info) {
      this.log("INFO", data, message);
    }
  }

  debug(data: any, message?: string): void {
    if (this.level >= LOG_LEVELS.debug) {
      this.log("DEBUG", data, message);
    }
  }

  private log(level: string, data: any, message?: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message: message || (typeof data === "string" ? data : undefined),
      data: typeof data === "object" ? data : undefined,
    };

    // In production, this would be sent to CloudWatch
    // For now, just console.log in JSON format for structured logging
    console.log(JSON.stringify(logEntry));
  }
}

export function createLogger(context: string): Logger {
  return new SimpleLogger(context);
}