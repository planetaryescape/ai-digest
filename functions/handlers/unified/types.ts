/**
 * Unified types for cross-platform handlers
 */

export interface UnifiedRequest {
  type: "http" | "timer" | "event";
  method?: string;
  path?: string;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
  source?: string;
  cleanup?: boolean;
  batchSize?: number;
  invocationId: string;
  timestamp: Date;

  // Historical mode fields
  mode?: "weekly" | "cleanup" | "historical";
  startDate?: string; // ISO format date
  endDate?: string; // ISO format date
  includeArchived?: boolean;
}

export interface UnifiedResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
}

export interface UnifiedContext {
  functionName: string;
  invocationId: string;
  logger: UnifiedLogger;
}

export interface UnifiedLogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}
