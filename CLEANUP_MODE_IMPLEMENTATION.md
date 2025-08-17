# Cleanup Mode Implementation

## Overview

Added support for processing ALL unarchived AI emails in cleanup mode with intelligent batching to avoid rate limits and context window exhaustion.

## Changes Made

### 1. Gmail Client (`functions/lib/gmail.ts`)

- Added `getAllAIEmails()` method to fetch ALL emails from inbox (not just last 7 days)
- Added `archiveOldEmails()` method to archive old AI emails after processing
- Updated `archiveMessages()` to process in batches of 100 to avoid API limits

### 2. Digest Processor (`functions/core/digest-processor.ts`)

- Added `processCleanupDigest()` method for cleanup mode
- Implements batching with 50 emails per batch
- 5-second delay between batches to avoid rate limits
- Each batch gets its own digest email to avoid overwhelming the AI
- Archives all processed emails after completion

### 3. Storage Interface (`functions/lib/interfaces/storage.ts`)

- Added `getAllProcessedIds()` method to get all previously processed email IDs

### 4. Storage Implementations

- **S3 Storage** (`functions/lib/aws/s3-storage.ts`): Added `getAllProcessedIds()` method
- **DynamoDB Storage** (`functions/lib/aws/storage.ts`): Added `getAllProcessedIds()` method

### 5. Lambda Handlers

- **weekly-digest** (`functions/handlers/aws/weekly-digest.ts`):
  - Now accepts `cleanup` flag in event payload
  - Routes to cleanup or weekly processing based on flag

- **run-now** (`functions/handlers/aws/run-now.ts`):
  - Accepts `cleanup` parameter via query string or request body
  - Passes cleanup flag to weekly-digest Lambda

## Usage

### Regular Weekly Processing (Default)

```bash
# Via API Gateway
curl https://your-api-gateway/run-now

# Or using AWS CLI
aws lambda invoke \
  --function-name run-now \
  --payload '{}' \
  response.json
```

### Cleanup Mode (Process ALL Unarchived Emails)

```bash
# Via API Gateway with query parameter
curl https://your-api-gateway/run-now?cleanup=true

# Or with JSON body
curl -X POST https://your-api-gateway/run-now \
  -H "Content-Type: application/json" \
  -d '{"cleanup": true}'

# Or using AWS CLI
aws lambda invoke \
  --function-name run-now \
  --payload '{"cleanup": true}' \
  response.json
```

## Batching Strategy

To avoid rate limits and context window exhaustion:

1. **Batch Size**: 50 emails per batch
2. **Delay Between Batches**: 5 seconds
3. **Separate Digests**: Each batch generates its own digest email
4. **Error Handling**: If one batch fails, processing continues with the next batch

## Example Response

### Weekly Mode Response

```json
{
  "success": true,
  "mode": "weekly",
  "weeklyDigestResponse": {
    "success": true,
    "message": "Successfully processed 15 AI emails and sent digest",
    "details": {
      "emailsFound": 47,
      "emailsProcessed": 15
    }
  },
  "timestamp": "2024-12-18T10:30:00.000Z",
  "invocationId": "abc-123"
}
```

### Cleanup Mode Response

```json
{
  "success": true,
  "mode": "cleanup",
  "weeklyDigestResponse": {
    "success": true,
    "message": "Successfully processed 250 AI emails in 5 batches",
    "details": {
      "emailsFound": 500,
      "emailsProcessed": 250,
      "batches": 5
    }
  },
  "timestamp": "2024-12-18T10:35:00.000Z",
  "invocationId": "def-456"
}
```

## Deployment

1. Build the Lambda functions:

```bash
npm run build:aws
```

2. Deploy with Terraform:

```bash
cd terraform/aws
terraform plan
terraform apply
```

## Important Notes

1. **First Run**: On the first cleanup run, it may process a large number of emails. Subsequent runs will only process new unarchived emails.

2. **Rate Limits**: The system respects Gmail API rate limits with batching and delays.

3. **Multiple Digest Emails**: In cleanup mode, you'll receive multiple digest emails (one per batch of 50 emails).

4. **Archiving**: After processing, emails are automatically archived to keep the inbox clean.

5. **AWS Credentials**: Ensure AWS credentials are configured before deploying:

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```
