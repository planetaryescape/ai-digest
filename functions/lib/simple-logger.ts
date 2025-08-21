// Simple console-based logger for Azure Functions
export interface SimpleLogger {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export function createSimpleLogger(name: string): SimpleLogger {
  const prefix = `[${name}]`;

  return {
    info: (message: string, ...args: any[]) => {
      console.log(`${prefix} INFO:`, message, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`${prefix} ERROR:`, message, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`${prefix} WARN:`, message, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      if (process.env.LOG_LEVEL === "debug") {
        console.log(`${prefix} DEBUG:`, message, ...args);
      }
    },
  };
}
