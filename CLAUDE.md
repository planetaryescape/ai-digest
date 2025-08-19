# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Digest is a multi-cloud automated newsletter summarizer that fetches AI-related emails from Gmail, processes them with OpenAI, and sends weekly digests. The system supports both Azure Functions and AWS Lambda deployments with a unified handler architecture achieving 70% code reduction.

## Essential Commands

### Building
```bash
bun run build:azure      # Build Azure Functions
bun run build:aws        # Build AWS Lambda functions  
bun run build:all        # Build for both platforms
bun run zip              # Create deployment packages

# Frontend build (using bun)
cd frontend && bun run build  # Build Next.js frontend
```

### Deployment
```bash
# Azure
bun run deploy:azure     # Full deploy with Terraform

# AWS
bun run deploy:aws       # Full deploy with Terraform
bun run update:aws       # Quick update Lambda code only (no Terraform)
```

### Development
```bash
bun run dev:email        # Preview email templates locally
bun run lint             # Lint and fix with Biome
bun run typecheck        # TypeScript type checking
bun run test             # Run tests with Vitest
bun run test:watch       # Run tests in watch mode
bun run test:coverage    # Generate test coverage report
bun run generate:oauth   # Generate Gmail OAuth token

# Frontend development (using bun)
cd frontend && bun run dev  # Start Next.js development server
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

### Agent-Based Architecture
The system features a comprehensive agent-based architecture with deep analysis capabilities:

#### Specialized Agents
1. **EmailFetcherAgent** - Metadata-first fetching (70% fewer API calls)
2. **ClassifierAgent** - Batch classification of unknown senders
3. **ContentExtractorAgent** - Firecrawl integration for deep article extraction
4. **ResearchAgent** - Brave Search API for additional context
5. **AnalysisAgent** - GPT-5/O1 with high reasoning effort
6. **CriticAgent** - Opinionated commentary generation

#### Key Features
- **DigestProcessor** - Main orchestrator for agent coordination
- **Enhanced sender tracking** - Tracks both AI and non-AI senders with confidence decay
- **Cost control** - Hard limits on API usage with real-time tracking
- **Circuit breakers** - Prevents cascade failures across all external services
- **Graceful degradation** - Falls back to simpler processing when cost limits approached

### Recent Refactoring (Phase 2 - Completed)
The codebase has undergone major architectural improvements with professional design patterns:

#### Unified Handler Architecture
- **70% code reduction** between Azure/AWS handlers
- Platform adapters abstract cloud-specific details
- Single codebase with clean separation of concerns
- Located in `functions/handlers/unified/`

#### Design Patterns Implemented
1. **Strategy Pattern** - Configuration management (`functions/lib/config/`)
2. **Command Pattern** - Email operations (`functions/lib/commands/`)
3. **Decorator Pattern** - Logging, metrics, retry, caching (`functions/lib/decorators/`)
4. **Builder Pattern** - Complex object creation (`functions/lib/builders/`)
5. **Repository Pattern** - Data access abstraction (`functions/lib/repositories/`)
6. **Result Pattern** - Functional error handling (`functions/lib/types/Result.ts`)
7. **Pipeline Pattern** - Email processing workflow (`functions/lib/pipeline/`)
8. **Circuit Breaker** - External API resilience (`functions/lib/circuit-breaker.ts`)
9. **Factory Pattern** - Storage client creation (`functions/lib/storage-factory.ts`)
10. **AI Detection Strategies** - Pluggable email detection (`functions/lib/gmail/ai-detection-strategies.ts`)

### Multi-Cloud Design
The codebase supports dual deployment with unified handlers:
- **Azure Functions** - Uses Azure Table Storage
- **AWS Lambda** - Uses S3/DynamoDB

Shared business logic lives in:
- `functions/core/` - Core business logic (DigestProcessor)
- `functions/lib/` - Shared utilities and services
- `functions/handlers/unified/` - Unified handler architecture
- `functions/handlers/azure/` - Azure-specific entry points (thin wrappers)
- `functions/handlers/aws/` - AWS-specific entry points (thin wrappers)

### Key Components

1. **Gmail Integration** (`functions/lib/gmail.ts`)
   - OAuth2 authentication with refresh tokens
   - AI email detection via multiple strategies
   - Batched processing to avoid API limits
   - Code duplication eliminated through method extraction

2. **AI Processing** (`functions/lib/summarizer.ts`)
   - Uses Vercel AI SDK with structured output (Zod schemas)
   - Generates digestible summaries without markdown parsing
   - Role-specific advice and product opportunities
   - Circuit breaker for API resilience

3. **Storage Abstraction** (`functions/lib/interfaces/storage.ts`)
   - Interface allows swapping between Azure Tables, S3, and DynamoDB
   - Repository pattern for data operations
   - Tracks processed emails to prevent duplicates
   - Known AI senders learning system

4. **Email Templates** (`emails/`)
   - React Email with Tailwind CSS
   - Inline styles for email client compatibility
   - Clean, minimalist design for readability
   - Reusable components extracted

5. **Email Processing Pipeline** (`functions/lib/pipeline/`)
   - Composable stages for email processing
   - Deduplication, filtering, batching
   - Result pattern for error handling

6. **Metrics & Monitoring** (`functions/lib/metrics.ts`)
   - In-memory and CloudWatch collectors
   - Automatic metric flushing
   - Performance tracking

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
- **AWS SDK**: Uses v3 with modular imports
- **Context**: Use `awsRequestId` not `requestId`
- **Permissions**: Resource-based policies via `add-resource-permission.sh`
- **Timeouts**: run-now=5min, weekly-digest=15min
- **Invocation**: Async for cleanup mode, sync for weekly

### Build System
- Uses esbuild with CommonJS output for Lambda compatibility
- React shim injection for email templates
- Handles both Azure and AWS packaging requirements
- Lambda functions placed at package root (not subdirectories)
- TypeScript generics in arrow functions must use `function<T>` syntax

### Email Processing
- Gmail API batch limits: 100 messages per batchModify
- OpenAI context limits: 50 emails per digest batch
- Archive old emails after processing to maintain inbox hygiene
- Cache manager available for optimization

## Environment Configuration

### Required Secrets
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
- `OPENAI_API_KEY`, `HELICONE_API_KEY`
- `RESEND_API_KEY`, `RECIPIENT_EMAIL`

### Storage Configuration
- Azure: `AZURE_STORAGE_CONNECTION_STRING`
- AWS S3: `S3_BUCKET`, `STORAGE_TYPE=s3`
- AWS DynamoDB: `DYNAMODB_TABLE`, `STORAGE_TYPE=dynamodb`

### Configuration Strategy
- Production/Development configs via Strategy pattern
- ConfigManager singleton for centralized config
- Environment detection automatic

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

### TypeScript Build Errors
- Generic arrow functions: Use `async function<T>()` not `async <T>() =>`
- AWS SDK: Import from `@aws-sdk/client-*` packages

## Code Style Requirements

- TypeScript with strict mode
- Biome for linting/formatting (config in `biome.json`)
- No console.log in production (use structured logging)
- CommonJS exports for Lambda handlers
- Avoid comments unless absolutely necessary
- Use design patterns where appropriate
- Maintain cyclomatic complexity < 5

## Testing Strategy

- Unit tests with Vitest
- Mock Service Worker (MSW) for API mocking
- Test files colocated with source files (`.test.ts`)
- Focus on business logic and integration points
- Current coverage: ~11% (needs improvement)

## Performance Optimizations

- Connection pooling framework ready
- Cache manager available
- Lazy loading utilities planned
- Parallel command execution supported
- Circuit breaker for external APIs

## Future Improvements (TODO)

1. **Testing**: Increase coverage to 80%+
2. **Monitoring**: Add comprehensive CloudWatch dashboards
3. **Documentation**: Architecture diagrams and API docs
4. **CI/CD**: GitHub Actions pipeline
5. **Patterns**: Implement Saga pattern for complex workflows
6. **Performance**: Implement connection pooling
7. **Utilities**: Add functional programming helpers