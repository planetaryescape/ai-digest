# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Digest is a multi-cloud automated newsletter summarizer that fetches AI-related emails from Gmail, processes them with OpenAI, and sends weekly digests. The system supports both Azure Functions and AWS Lambda deployments with shared business logic.

## Essential Commands

### Building
```bash
npm run build:azure      # Build Azure Functions
npm run build:aws        # Build AWS Lambda functions  
npm run build:all        # Build for both platforms
npm run zip              # Create deployment packages
```

### Deployment
```bash
# Azure
npm run deploy:azure     # Full deploy with Terraform

# AWS
npm run deploy:aws       # Full deploy with Terraform
npm run update:aws       # Quick update Lambda code only (no Terraform)
```

### Development
```bash
npm run dev:email        # Preview email templates locally
npm run lint             # Lint and fix with Biome
npm run typecheck        # TypeScript type checking
npm run generate:oauth   # Generate Gmail OAuth token
```

### Testing AWS Lambdas
```bash
# Regular weekly digest (last 7 days)
aws lambda invoke --function-name ai-digest-run-now \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' response.json

# Cleanup mode (ALL unarchived emails)  
aws lambda invoke --function-name ai-digest-run-now \
  --cli-binary-format raw-in-base64-out \
  --payload '{"cleanup": true}' response.json
```

## Architecture

### Multi-Cloud Design
The codebase supports dual deployment:
- **Azure Functions** (original) - Uses Azure Table Storage
- **AWS Lambda** (new) - Uses S3/DynamoDB

Shared business logic lives in `functions/core/` and `functions/lib/` with cloud-specific implementations in:
- `functions/handlers/azure/` - Azure Function triggers
- `functions/handlers/aws/` - Lambda handlers
- `functions/lib/azure/` - Azure storage implementation
- `functions/lib/aws/` - AWS storage implementations

### Key Components

1. **Gmail Integration** (`functions/lib/gmail.ts`)
   - OAuth2 authentication with refresh tokens
   - AI email detection via keywords and known senders
   - Batched processing to avoid API limits

2. **AI Processing** (`functions/lib/summarizer.ts`)
   - Uses Vercel AI SDK with structured output (Zod schemas)
   - Generates digestible summaries without markdown parsing
   - Role-specific advice and product opportunities

3. **Storage Abstraction** (`functions/lib/interfaces/storage.ts`)
   - Interface allows swapping between Azure Tables, S3, and DynamoDB
   - Tracks processed emails to prevent duplicates
   - Known AI senders learning system

4. **Email Templates** (`emails/`)
   - React Email with Tailwind CSS
   - Inline styles for email client compatibility
   - Clean, minimalist design for readability

### Cleanup Mode Implementation

The system supports two processing modes:

1. **Weekly Mode** (default): Processes last 7 days of emails synchronously
2. **Cleanup Mode**: Processes ALL unarchived emails with:
   - Batch processing (50 emails per batch)
   - 5-second delays between batches
   - Async invocation to avoid timeouts
   - Separate digest email per batch

## Critical Implementation Details

### AWS Lambda Specifics
- **Environment Variables**: Use `WEEKLY_DIGEST_FUNCTION_NAME` not ARN
- **Permissions**: Resource-based policies via `add-resource-permission.sh`
- **Timeouts**: run-now=5min, weekly-digest=15min
- **Invocation**: Async for cleanup mode, sync for weekly

### Build System
- Uses esbuild with CommonJS output for Lambda compatibility
- React shim injection for email templates
- Handles both Azure and AWS packaging requirements
- Lambda functions placed at package root (not subdirectories)

### Email Processing
- Gmail API batch limits: 100 messages per batchModify
- OpenAI context limits: 50 emails per digest batch
- Archive old emails after processing to maintain inbox hygiene

## Environment Configuration

### Required Secrets
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
- `OPENAI_API_KEY`, `HELICONE_API_KEY`
- `RESEND_API_KEY`, `RECIPIENT_EMAIL`

### Storage Configuration
- Azure: `AZURE_STORAGE_CONNECTION_STRING`
- AWS S3: `S3_BUCKET`, `STORAGE_TYPE=s3`
- AWS DynamoDB: `DYNAMODB_TABLE`, `STORAGE_TYPE=dynamodb`

## Common Issues and Solutions

### Lambda "Weekly digest ARN not configured"
Old code still deployed. Run `npm run update:aws` to update.

### Lambda Timeout Errors
- Weekly-digest needs 15min timeout for cleanup mode
- Run-now uses async invocation for cleanup to avoid waiting

### Permission Errors
Run `./scripts/add-resource-permission.sh` to fix Lambda invoke permissions.

### Gmail Rate Limits
Built-in batching with delays handles this automatically.

## Code Style Requirements

- TypeScript with strict mode
- Biome for linting/formatting (config in `biome.json`)
- No console.log in production (use structured logging)
- CommonJS exports for Lambda handlers
- Avoid comments unless absolutely necessary