// Simple console-based logger for Azure Functions
export interface SimpleLogger {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export function createSimpleLogger(name: string): SimpleLogger {
  const _prefix = `[${name}]`;

  return {
    info: (_message: string, ..._args: any[]) => {},
    error: (_message: string, ..._args: any[]) => {},
    warn: (_message: string, ..._args: any[]) => {},
    debug: (_message: string, ..._args: any[]) => {
      if (process.env.LOG_LEVEL === "debug") {
      }
    },
  };
}
