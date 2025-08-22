import type { DigestResult } from "../../core/digest-processor";
import type { UnifiedContext, UnifiedRequest } from "./types";

/**
 * Platform adapter interface for abstracting cloud provider differences
 */
export interface IPlatformAdapter {
  /**
   * Parse platform-specific event into unified request
   */
  parseRequest(event: any, context: any): UnifiedRequest;

  /**
   * Create unified context from platform context
   */
  createContext(context: any): UnifiedContext;

  /**
   * Format successful result for platform
   */
  formatResponse(result: DigestResult): any;

  /**
   * Format error for platform
   */
  formatError(error: Error, context: UnifiedContext): any;

  /**
   * Determine if this is a timer/scheduled trigger
   */
  isTimerTrigger(event: any): boolean;

  /**
   * Determine if cleanup mode is requested
   */
  isCleanupMode(event: any): boolean;
}
