/**
 * Export the batch operations from the main module
 * This file exists for cleaner import paths
 */

export { GmailBatchOperations as BatchOperations } from "../gmail-batch-operations";

// Type alias for batch operation results
export interface BatchOperationResult {
  success: boolean;
  messageIds: string[];
  errors?: string[];
}
