/**
 * Type definitions for Lambda handlers
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";

/**
 * Custom event types for our Lambda functions
 */
export interface DigestLambdaEvent {
  /** Indicates if cleanup mode should be used */
  cleanup?: boolean;
  /** Processing mode */
  mode?: "weekly" | "cleanup";
  /** Source of the invocation */
  source?: string;
  /** HTTP method if invoked via API Gateway */
  httpMethod?: string;
  /** Query string parameters */
  queryStringParameters?: Record<string, string>;
  /** Request body */
  body?: string;
}

/**
 * Combined event type for Lambda handlers
 */
export type LambdaEvent = ScheduledEvent | APIGatewayProxyEvent | DigestLambdaEvent;

/**
 * Response for digest operations
 */
export interface DigestLambdaResponse extends APIGatewayProxyResult {
  body: string;
}

/**
 * Response body structure
 */
export interface DigestResponseBody {
  success: boolean;
  message?: string;
  mode?: "weekly" | "cleanup";
  details?: {
    emailsFound: number;
    emailsProcessed: number;
    batches?: number;
    error?: string;
  };
  timestamp: string;
  invocationId?: string;
  asyncInvocation?: boolean;
  weeklyDigestResponse?: unknown;
}

/**
 * Lambda handler function type
 */
export type DigestLambdaHandler = (
  event: LambdaEvent,
  context: Context
) => Promise<void | DigestLambdaResponse>;
