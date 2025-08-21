/**
 * Centralized constants for the AI Digest application
 */

// Cost control limits
export const COST_LIMITS = {
  /** Maximum number of emails to process in a single run */
  MAX_EMAILS_PER_RUN: 500,
  /** Maximum cost per run in dollars */
  MAX_COST_PER_RUN: 1.0,
  /** Maximum OpenAI API calls per run */
  MAX_OPENAI_CALLS_PER_RUN: 50,
  /** Maximum Firecrawl API calls per run */
  MAX_FIRECRAWL_CALLS_PER_RUN: 100,
  /** Maximum Brave searches per run */
  MAX_BRAVE_SEARCHES_PER_RUN: 50,
  /** Cost per GPT-5 (GPT-4o) API call in dollars (rough estimate) */
  OPENAI_GPT5_COST: 0.10,
  /** Cost per GPT-4o-mini API call in dollars (rough estimate) */
  OPENAI_GPT4O_MINI_COST: 0.01,
  /** Cost per Firecrawl URL extraction in dollars */
  FIRECRAWL_COST_PER_URL: 0.001,
  /** Cost per Brave search in dollars */
  BRAVE_SEARCH_COST: 0.001,
} as const;

// Rate limiting constants
export const RATE_LIMITS = {
  /** Gmail batch size for API operations */
  GMAIL_BATCH_SIZE: 100,
  /** Delay between Gmail batch operations in milliseconds */
  GMAIL_BATCH_DELAY_MS: 1000,
  /** Maximum URLs to extract per email */
  MAX_URLS_PER_EMAIL: 5,
  /** OpenAI requests per minute */
  OPENAI_RPM: 50,
  /** OpenAI batch size for classification */
  OPENAI_BATCH_SIZE: 20,
  /** Firecrawl requests per minute */
  FIRECRAWL_RPM: 100,
} as const;

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
  /** Default batch size when not specified */
  DEFAULT_BATCH_SIZE: 50,
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
  /** Maximum length for email subject in digest */
  MAX_SUBJECT_LENGTH: 100,
} as const;