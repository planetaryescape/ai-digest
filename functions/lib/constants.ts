/**
 * Centralized constants for the AI Digest application
 */

// Batch processing limits
export const BATCH_LIMITS = {
  /** Maximum number of messages per Gmail API batch operation */
  GMAIL_API: 100,
  /** Maximum number of emails to process in a single OpenAI context */
  OPENAI_CONTEXT: 50,
  /** Maximum number of items per DynamoDB batch write operation */
  DYNAMODB_WRITE: 25,
  /** Number of emails to process per batch in cleanup mode */
  CLEANUP_BATCH_SIZE: 50,
  /** Delay in milliseconds between batch operations to avoid rate limits */
  BATCH_DELAY_MS: 5000,
} as const;

// Lambda timeouts
export const TIMEOUTS = {
  /** Timeout for run-now Lambda function (5 minutes) */
  LAMBDA_RUN_NOW_MS: 5 * 60 * 1000,
  /** Timeout for weekly-digest Lambda function (15 minutes) */
  LAMBDA_WEEKLY_DIGEST_MS: 15 * 60 * 1000,
} as const;

// Data retention
export const RETENTION = {
  /** Number of days to keep processed email records */
  PROCESSED_EMAILS_DAYS: 90,
  /** Number of days before archiving old emails */
  ARCHIVE_AFTER_DAYS: 7,
} as const;

// API limits
export const API_LIMITS = {
  /** Maximum results per Gmail API list request */
  GMAIL_MAX_RESULTS: 500,
  /** Default maximum results for Gmail queries */
  GMAIL_DEFAULT_MAX_RESULTS: 500,
  /** Number of emails to verify after processing */
  VERIFICATION_SAMPLE_SIZE: 3,
} as const;

// Email processing
export const EMAIL_PROCESSING = {
  /** Maximum number of sections to include in digest */
  MAX_SECTIONS: 50,
  /** Maximum articles per email to process */
  MAX_ARTICLES_PER_EMAIL: 2,
  /** Maximum length for truncated strings */
  TRUNCATE_LENGTH: {
    TITLE: 120,
    DESCRIPTION: 280,
    SENDER: 100,
    SUBJECT: 140,
  },
} as const;

// Default values
export const DEFAULTS = {
  /** Default AWS region */
  AWS_REGION: "us-east-1",
  /** Default DynamoDB table name */
  DYNAMODB_TABLE: "ai-digest-processed-emails",
  /** Default S3 bucket prefix */
  S3_PREFIX: "processed-emails",
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Log levels
export const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;

// Email categories for digest
export const EMAIL_CATEGORIES = {
  PRODUCT: "product",
  RESEARCH: "research",
  INDUSTRY: "industry",
  TOOL: "tool",
  REGULATORY: "regulatory",
  BUSINESS: "business",
} as const;

// Takeaway categories
export const TAKEAWAY_CATEGORIES = {
  TECHNICAL: "technical",
  BUSINESS: "business",
  RISK: "risk",
} as const;

// Storage types
export const STORAGE_TYPES = {
  S3: "s3",
  DYNAMODB: "dynamodb",
  AZURE: "azure",
} as const;
