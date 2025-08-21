import crypto from "node:crypto";
import type { Logger } from "pino";

export interface SerializedError {
  message: string;
  name: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  requestId?: string;
  traceId?: string;
  path?: string[];
  context?: Record<string, unknown>;
  cause?: SerializedError;
  timestamp: string;
}

export interface RequestTrace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  path: string[];
  startTime: number;
  context: Record<string, unknown>;
}

/**
 * Enhanced error serializer that preserves all error information
 */
export function serializeError(error: unknown, trace?: RequestTrace): SerializedError {
  const timestamp = new Date().toISOString();

  if (error instanceof Error) {
    const serialized: SerializedError = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      timestamp,
    };

    // Add any custom properties from the error
    const errorObj = error as any;
    if (errorObj.code) serialized.code = errorObj.code;
    if (errorObj.statusCode) serialized.statusCode = errorObj.statusCode;
    if (errorObj.requestId) serialized.requestId = errorObj.requestId;
    if (errorObj.context) serialized.context = errorObj.context;

    // Add trace information if available
    if (trace) {
      serialized.traceId = trace.traceId;
      serialized.path = trace.path;
      if (trace.context && Object.keys(trace.context).length > 0) {
        serialized.context = { ...serialized.context, ...trace.context };
      }
    }

    // Recursively serialize cause if present
    if (errorObj.cause) {
      serialized.cause = serializeError(errorObj.cause, trace);
    }

    return serialized;
  }

  // Handle non-Error objects
  if (typeof error === "object" && error !== null) {
    const errorObj = error as any;
    return {
      message: errorObj.message || JSON.stringify(error),
      name: errorObj.name || "UnknownError",
      timestamp,
      context: errorObj,
      traceId: trace?.traceId,
      path: trace?.path,
    };
  }

  // Handle primitive values
  return {
    message: String(error),
    name: "UnknownError",
    timestamp,
    traceId: trace?.traceId,
    path: trace?.path,
  };
}

/**
 * Request trace manager for tracking request flow
 */
export class RequestTracer {
  private static activeTraces = new Map<string, RequestTrace>();

  /**
   * Start a new trace
   */
  static startTrace(
    operation: string,
    parentTraceId?: string,
    parentSpanId?: string
  ): RequestTrace {
    const traceId = parentTraceId || crypto.randomUUID();
    const spanId = crypto.randomBytes(8).toString("hex");

    const trace: RequestTrace = {
      traceId,
      spanId,
      parentSpanId,
      path: [operation],
      startTime: Date.now(),
      context: {},
    };

    RequestTracer.activeTraces.set(traceId, trace);
    return trace;
  }

  /**
   * Add a step to the request path
   */
  static addStep(traceId: string, step: string, context?: Record<string, unknown>): void {
    const trace = RequestTracer.activeTraces.get(traceId);
    if (trace) {
      trace.path.push(step);
      if (context) {
        trace.context = { ...trace.context, ...context };
      }
    }
  }

  /**
   * Get current trace
   */
  static getTrace(traceId: string): RequestTrace | undefined {
    return RequestTracer.activeTraces.get(traceId);
  }

  /**
   * End a trace
   */
  static endTrace(traceId: string): RequestTrace | undefined {
    const trace = RequestTracer.activeTraces.get(traceId);
    if (trace) {
      RequestTracer.activeTraces.delete(traceId);
    }
    return trace;
  }

  /**
   * Get trace summary for logging
   */
  static getTraceSummary(trace: RequestTrace): Record<string, unknown> {
    return {
      traceId: trace.traceId,
      spanId: trace.spanId,
      parentSpanId: trace.parentSpanId,
      path: trace.path.join(" -> "),
      duration: Date.now() - trace.startTime,
      stepCount: trace.path.length,
      context: trace.context,
    };
  }
}

/**
 * Enhanced error logger with full context
 */
export function logErrorWithContext(
  logger: Logger,
  error: unknown,
  message: string,
  trace?: RequestTrace
): void {
  const serializedError = serializeError(error, trace);

  logger.error(
    {
      error: serializedError,
      trace: trace ? RequestTracer.getTraceSummary(trace) : undefined,
      errorType: serializedError.name,
      errorMessage: serializedError.message,
      requestPath: trace?.path.join(" -> "),
      traceId: trace?.traceId,
    },
    message
  );
}

/**
 * Create a traced logger that automatically includes trace context
 */
export function createTracedLogger(logger: Logger, trace: RequestTrace): Logger {
  return logger.child({
    traceId: trace.traceId,
    spanId: trace.spanId,
    requestPath: trace.path.join(" -> "),
  });
}

/**
 * Wrap an async function with error logging and tracing
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  logger: Logger,
  operation: string
): T {
  return (async (...args: any[]) => {
    const trace = RequestTracer.startTrace(operation);
    const tracedLogger = createTracedLogger(logger, trace);

    try {
      tracedLogger.info(`Starting ${operation}`);
      const result = await fn(...args);
      tracedLogger.info(`Completed ${operation}`);
      return result;
    } catch (error) {
      logErrorWithContext(tracedLogger, error, `Failed: ${operation}`, trace);
      throw error;
    } finally {
      RequestTracer.endTrace(trace.traceId);
    }
  }) as T;
}

/**
 * Create an error with additional context
 */
export class ContextualError extends Error {
  public readonly context: Record<string, unknown>;
  public readonly code?: string;
  public readonly statusCode?: number;
  public readonly requestId?: string;
  public readonly traceId?: string;

  constructor(
    message: string,
    options?: {
      cause?: Error;
      code?: string;
      statusCode?: number;
      context?: Record<string, unknown>;
      requestId?: string;
      traceId?: string;
    }
  ) {
    super(message);
    this.name = "ContextualError";
    this.context = options?.context || {};
    this.code = options?.code;
    this.statusCode = options?.statusCode;
    this.requestId = options?.requestId;
    this.traceId = options?.traceId;
    if (options?.cause) {
      (this as any).cause = options.cause;
    }
  }
}
