# CLAUDE.md - AI Digest Codebase Documentation

This file provides comprehensive guidance to Claude Code (claude.ai/code) and engineers when working with the AI Digest codebase.

## 🚀 Project Overview

**AI Digest** is a sophisticated multi-cloud automated newsletter summarizer that transforms your email inbox into actionable insights.

### Purpose & Problem Solved
- **Problem**: Information overload from AI newsletters and tech emails
- **Solution**: Automated weekly digests with intelligent summarization, role-specific advice, and product opportunity identification
- **Target Users**: Software engineers, ML engineers, data scientists, product managers, founders, and tech professionals

### Key Features
- 📧 **Intelligent Email Processing**: Metadata-first Gmail fetching with 70% API reduction
- 🤖 **6-Agent Architecture**: Specialized agents for fetching, classification, extraction, research, analysis, and commentary
- ☁️ **Multi-Cloud Support**: Unified handlers for AWS Lambda and Azure Functions
- 💰 **Cost Optimization**: Hard limits ($1 default) with real-time tracking
- 🔄 **Resilient Processing**: Circuit breakers, graceful degradation, and retry logic
- 🎨 **Beautiful Digests**: React Email + Tailwind CSS for professional formatting

### Key Metrics
- **Codebase Size**: 8,298 lines of TypeScript (59 source files)
- **Test Coverage**: ~11% (147 tests, 8 failing - critical improvement needed)
- **Production Readiness**: 6.5/10
- **Technical Debt**: ~1,801 lines of reinvented wheels
- **API Efficiency**: 70% reduction in Gmail API calls
- **Cost Control**: Hard limit of $1/run with real-time tracking
- **Performance**: 2-4 minutes (weekly), 5-15 minutes (cleanup mode)
- **TypeScript Errors**: 8 remaining (complex generics)

## 🏗️ Architecture & Design

### System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                        Entry Points                         │
│         AWS Lambda / Azure Functions / API Gateway          │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                    Unified Handlers                         │
│          BaseHandler → AWSHandler / AzureHandler            │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│               DigestProcessor (Orchestrator)                │
│                  Core Business Logic                        │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                  6-Agent Pipeline                           │
│  1. EmailFetcher → 2. Classifier → 3. ContentExtractor     │
│  4. Research → 5. Analysis → 6. Critic                      │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│              External Service Layer                         │
│   Gmail API | OpenAI GPT-4o/5 | Firecrawl | Brave Search   │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                  Storage Layer                              │
│      DynamoDB/S3 (AWS) | Table Storage (Azure)              │
└──────────────────────────────────────────────────────────────┘
```

### Agent-Based System

The system employs 6 specialized agents for comprehensive email processing:

#### 1. EmailFetcherAgent (`functions/lib/agents/EmailFetcherAgent.ts`)
- **Purpose**: Efficiently fetch emails with metadata-first approach
- **Optimization**: 70% reduction in API calls through intelligent filtering
- **Features**: Sender classification, batch fetching, deduplication

#### 2. ClassifierAgent (`functions/lib/agents/ClassifierAgent.ts`)
- **Purpose**: Batch classify unknown senders as AI/non-AI
- **Model**: GPT-4o-mini for fast classification
- **Optimization**: Processes 20 senders in single API call

#### 3. ContentExtractorAgent (`functions/lib/agents/ContentExtractorAgent.ts`)
- **Purpose**: Deep content extraction from linked articles
- **Integration**: Firecrawl API for web scraping
- **Fallback**: Graceful degradation when extraction fails

#### 4. ResearchAgent (`functions/lib/agents/ResearchAgent.ts`)
- **Purpose**: Augment summaries with web research
- **Integration**: Brave Search API
- **Features**: Fact-checking, context enrichment

#### 5. AnalysisAgent (`functions/lib/agents/AnalysisAgent.ts`)
- **Purpose**: Generate comprehensive summaries with role-specific insights
- **Model**: GPT-4o/GPT-5 with high reasoning effort
- **Output**: Structured JSON with summaries, advice, and opportunities
- **Processing**: ~10-30 seconds per digest

#### 6. CriticAgent (`functions/lib/agents/CriticAgent.ts`)
- **Purpose**: Generate opinionated commentary
- **Style**: Balanced, thoughtful criticism
- **Features**: Trend analysis, implications assessment

### Design Patterns Implemented

1. **Strategy Pattern** (`functions/lib/config/`)
   - Configuration management with environment-specific strategies
   - Platform-agnostic settings

2. **Command Pattern** (`functions/lib/commands/`)
   - Encapsulated email operations
   - Undo/redo capability for batch operations

3. **Repository Pattern** (`functions/lib/repositories/`)
   - Abstract data access layer
   - Consistent interface across storage backends

4. **Circuit Breaker** (`functions/lib/circuit-breaker-enhanced.ts`)
   - Prevents cascade failures
   - 3 failures → 30s cooldown
   - Per-service isolation

5. **Factory Pattern** (`functions/lib/storage-factory.ts`)
   - Dynamic storage client creation
   - Platform-specific implementations

6. **Pipeline Pattern** (`functions/lib/pipeline/`)
   - Sequential email processing
   - Error propagation and recovery

7. **Result Pattern** (`functions/lib/types/Result.ts`)
   - Functional error handling
   - Type-safe success/failure states

8. **Adapter Pattern** (Platform Abstraction)
   - Multi-cloud platform abstraction
   - Unified interface across AWS/Azure

## 🛠️ Technology Stack

### Core Technologies
- **Language**: TypeScript 5.9+ (strict mode disabled for flexibility)
- **Runtime**: Node.js 20.x LTS
- **Package Manager**: Bun (faster than npm/yarn)
- **Build Tool**: esbuild (sub-second builds)
- **Test Framework**: Vitest (Vite-powered, fast)
- **Linter/Formatter**: Biome (faster than ESLint+Prettier)

### Cloud Platforms
- **AWS**: Lambda, DynamoDB, S3, EventBridge, CloudWatch
- **Azure**: Functions, Table Storage, Key Vault, Application Insights

### AI/ML Services
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-5 (when available)
- **Helicone**: API observability and caching
- **Firecrawl**: Web content extraction
- **Brave Search**: Web research and fact-checking

### Email & Communication
- **Gmail API**: OAuth2-based email fetching
- **Resend**: Transactional email delivery
- **React Email**: Component-based email templates
- **Tailwind CSS**: Styling for email templates

### Infrastructure
- **Terraform**: Infrastructure as Code
- **GitHub Actions**: CI/CD pipeline
- **MSW**: Mock Service Worker for testing

## 📁 Project Structure

```text
ai-digest/
├── functions/              # Serverless function code
│   ├── core/              # Core business logic
│   │   └── digest-processor.ts    # Main orchestrator (500+ lines)
│   ├── handlers/          # Platform-specific entry points
│   │   ├── aws/          # Lambda handlers
│   │   ├── azure/        # Azure Function handlers
│   │   └── unified/      # Abstraction layer
│   ├── lib/              # Shared libraries
│   │   ├── agents/       # 6 specialized agents
│   │   ├── aws/          # AWS-specific implementations
│   │   ├── azure/        # Azure-specific implementations
│   │   ├── cache/        # Caching strategies
│   │   ├── commands/     # Command pattern implementations
│   │   ├── config/       # Configuration management
│   │   ├── gmail/        # Gmail API integration
│   │   ├── interfaces/   # TypeScript interfaces
│   │   ├── patterns/     # Design pattern implementations
│   │   ├── pipeline/     # Processing pipeline
│   │   ├── repositories/ # Data access layer
│   │   ├── schemas/      # Zod validation schemas
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utility functions
├── terraform/             # Infrastructure as Code
│   ├── aws/              # AWS resources
│   │   ├── main.tf       # Core AWS infrastructure
│   │   ├── pipeline.tf   # Step Functions pipeline
│   │   └── stepfunctions/# State machine definitions
│   └── azure/            # Azure resources
│       └── main.tf       # Core Azure infrastructure
├── frontend/             # Next.js dashboard (incomplete)
│   ├── app/             # App router pages
│   │   └── api/         # API routes
│   ├── components/      # React components
│   └── lib/            # Frontend utilities
├── emails/              # Email templates
│   └── components/      # React Email components
├── scripts/             # Build and deployment scripts
├── test/               # Test utilities and mocks
└── bin/                # CLI tools
```

### Key Files

- `functions/core/digest-processor.ts` - Main orchestration engine
- `functions/handlers/unified/BaseHandler.ts` - Cloud abstraction layer
- `functions/lib/agents/*.ts` - Agent implementations
- `functions/lib/circuit-breaker-enhanced.ts` - Resilience patterns
- `functions/lib/cost-tracker.ts` - Cost management
- `terraform/aws/main.tf` - AWS infrastructure
- `terraform/azure/main.tf` - Azure infrastructure

## 🔧 Development Workflow

### Prerequisites
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Clone repository
git clone <repo-url>
cd ai-digest

# Install dependencies
bun install

# Copy environment file
cp .env.example .env
```

### Essential Commands

#### Building
```bash
# Backend
bun run build:azure      # Build Azure Functions
bun run build:aws        # Build AWS Lambda functions  
bun run build:all        # Build for both platforms
bun run zip              # Create deployment packages

# Frontend (from frontend/ directory)
bun run build            # Build Next.js production bundle
bun run lint             # Run ESLint checks
bunx tsc --noEmit        # TypeScript type checking
```

#### Deployment
```bash
# Azure
bun run deploy:azure     # Full deploy with Terraform

# AWS  
bun run deploy:aws       # Full deploy with Terraform
bun run update:aws       # Quick Lambda code update (no Terraform)
```

#### Development
```bash
bun run dev:email        # Preview email templates locally
bun run lint             # Lint and fix with Biome
bun run typecheck        # TypeScript type checking
bun run test             # Run tests with Vitest
bun run test:watch       # Run tests in watch mode
bun run test:coverage    # Generate test coverage report
bun run generate:oauth   # Generate Gmail OAuth token
```

#### Testing Lambdas
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

### Development Environment Setup

1. **Gmail OAuth Setup**
   ```bash
   # 1. Create Google Cloud project
   # 2. Enable Gmail API
   # 3. Create OAuth credentials
   # 4. Generate refresh token
   bun run generate:oauth
   ```

2. **Environment Variables**
   ```bash
   # Required
   GMAIL_CLIENT_ID=xxx
   GMAIL_CLIENT_SECRET=xxx
   GMAIL_REFRESH_TOKEN=xxx
   OPENAI_API_KEY=xxx
   RESEND_API_KEY=xxx
   RECIPIENT_EMAIL=xxx
   
   # Optional enhancements
   FIRECRAWL_API_KEY=xxx
   BRAVE_API_KEY=xxx
   HELICONE_API_KEY=xxx
   ```

3. **Local Testing**
   ```bash
   # Test email templates
   bun run dev:email
   
   # Run function locally
   bun run functions/handlers/aws/run-now.ts
   ```

## 🔐 Security & Authentication

### Authentication Mechanisms
- **Gmail**: OAuth2 with refresh tokens (no password storage)
- **Cloud Resources**: Managed identities (Azure) / IAM roles (AWS)
- **API Keys**: Environment variables (⚠️ needs secrets manager)
- **Frontend**: Clerk authentication (incomplete)

### Security Best Practices
- No sensitive data in logs (PII scrubbing)
- API keys never committed to repository
- Encrypted storage for processed email IDs
- Rate limiting on all external API calls
- Circuit breakers prevent abuse
- Cost limits prevent runaway expenses

### Data Protection
- **PII Handling**: No sensitive data in logs
- **Storage**: Encrypted at rest (S3, DynamoDB)
- **Processing**: In-memory only, no persistence
- **Retention**: 90-day automatic cleanup
- **GDPR**: Compliant data handling patterns

### Security Gaps
- ⚠️ **No secrets management system** - API keys in env vars
- ⚠️ **API endpoints lack authentication** - Unprotected routes
- ⚠️ **Missing rate limiting** - Vulnerable to abuse
- ⚠️ **Permissive CORS configuration** - Security risk

## 🔌 Integration Points

### REST API Endpoints (Frontend)

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/health` | Health check | None |
| GET | `/api/digest` | Fetch latest digest | Clerk |
| POST | `/api/digest/trigger` | Manual trigger | Clerk |
| GET | `/api/senders` | List senders | Clerk |
| PUT | `/api/senders/:id` | Update classification | Clerk |

### External Service Limits

| Service | Rate Limit | Cost | Circuit Breaker |
|---------|------------|------|-----------------|
| Gmail API | 250 units/sec | Free | 3 failures → 30s |
| OpenAI | Via Helicone | ~$0.10/digest | 3 failures → 30s |
| Firecrawl | 100 req/min | $0.001/URL | 3 failures → 30s |
| Brave Search | 2000/month | Free tier | 3 failures → 30s |

### Lambda Configuration

| Function | Timeout | Memory | Trigger |
|----------|---------|--------|----------|
| run-now | 5 min | 1024 MB | Manual/API |
| weekly-digest | 15 min | 1024 MB | EventBridge |
| cleanup-batch | 5 min | 512 MB | Manual |

### Service Integration Details

#### Gmail API
- **Authentication**: OAuth2 with refresh tokens
- **Batch Operations**: 100 messages per batch
- **Optimization**: Metadata-first fetching (70% reduction)

#### OpenAI API
- **Models**: GPT-4o, GPT-4o-mini, GPT-5
- **Cost Control**: Hard limits with tracking
- **Optimization**: Batch processing (20 emails/call), Helicone caching

#### Firecrawl API
- **Purpose**: Article content extraction
- **Fallback**: Graceful degradation when extraction fails

#### Brave Search API
- **Purpose**: Research and fact-checking
- **Integration**: Optional enhancement
- **Caching**: 24-hour result cache

### Cloud Service Mappings

| Service Type | AWS | Azure | Purpose |
|-------------|-----|-------|---------|
| Compute | Lambda | Functions | Serverless execution |
| Storage | DynamoDB/S3 | Table Storage | Processed email tracking |
| Scheduling | EventBridge | Timer Trigger | Weekly digest schedule |
| Secrets | Secrets Manager | Key Vault | API key storage |
| Monitoring | CloudWatch | Application Insights | Logs and metrics |
| Queue | SQS | Service Bus | Async processing (planned) |

## ⚡ Performance & Scalability

### Performance Optimizations
- **Metadata-First Fetching**: 70% reduction in Gmail API calls
- **Batch Processing**: 20 emails per OpenAI call
- **Circuit Breakers**: Prevent cascade failures
- **Caching**: Helicone caches OpenAI responses
- **Parallel Processing**: Concurrent agent execution
- **Connection Pooling**: Framework ready (not implemented)

### Scalability Considerations
- **Serverless Architecture**: Auto-scales with demand
- **Stateless Functions**: Horizontal scaling capability
- **Queue-Based Processing**: Planned for high volume
- **Cost Controls**: Hard limits prevent runaway costs
- **Storage Partitioning**: Email ID-based sharding

### Performance Metrics
- **Email Fetch Time**: ~2-5 seconds for 100 emails
- **Classification Time**: ~1-2 seconds per batch
- **Analysis Time**: ~10-30 seconds per digest
- **Total Processing**: 2-4 minutes (weekly), 5-15 minutes (cleanup)
- **Cold Start**: ~1-2 seconds (Lambda), ~3-5 seconds (Azure)

## 🧪 Testing Strategy

### Current Coverage
- **Overall**: ~11% (needs improvement)
- **Unit Tests**: 8 test files
- **Integration Tests**: Limited
- **E2E Tests**: None

### Test Organization
```text
functions/
├── **/*.test.ts          # Unit tests colocated with source
test/
├── mocks/                # MSW request mocks
├── utils/                # Test utilities
└── setup.ts             # Test configuration
```

### Testing Approach
- **Framework**: Vitest (fast, Vite-powered)
- **Mocking**: MSW for API mocking
- **Coverage**: Target 80%+ coverage
- **CI/CD**: Tests run on every push

### Priority Areas for Testing
1. Agent orchestration logic
2. Cost tracking and limits
3. Circuit breaker behavior
4. Email classification accuracy
5. Storage abstraction layer

## 🎨 Code Patterns & Conventions

### Naming Conventions
- **Files**: kebab-case (`digest-processor.ts`)
- **Classes**: PascalCase (`DigestProcessor`)
- **Functions**: camelCase (`processWeeklyDigest`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_COST_LIMIT`)
- **Interfaces**: IPascalCase (`IStorageClient`)

### Code Style
- **Formatting**: Biome with 2-space indentation
- **Line Width**: 100 characters
- **Quotes**: Double quotes for strings
- **Semicolons**: Always use semicolons
- **Comments**: Minimal, only when necessary

### TypeScript Patterns
- **Strict Mode**: Disabled for flexibility
- **Interfaces**: Define contracts for abstraction
- **Zod Schemas**: Runtime validation
- **Result Type**: Functional error handling
- **Generic Types**: Use `function<T>` syntax for arrow functions

### Error Handling
- **Result Pattern**: Type-safe success/failure
- **Circuit Breakers**: Automatic recovery
- **Graceful Degradation**: Continue with reduced functionality
- **Structured Logging**: Pino with context

## 🐛 Common Issues & Solutions

### Issue: "Weekly digest ARN not configured"
**Solution**: Old Lambda code deployed. Run `bun run update:aws`

### Issue: Lambda Timeout Errors
**Solution**: 
- Weekly-digest needs 15min timeout for cleanup mode
- Use async invocation for cleanup to avoid waiting

### Issue: Permission Errors
**Solution**: Run `./scripts/add-resource-permission.sh` to fix Lambda invoke permissions

### Issue: Gmail Rate Limits
**Solution**: Built-in batching with delays handles automatically

### Issue: TypeScript Build Errors
**Solutions**:
- Generic arrow functions: Use `async function<T>()` not `async <T>() =>`
- AWS SDK: Import from `@aws-sdk/client-*` packages

### Issue: High OpenAI Costs
**Solutions**:
- Adjust `MAX_COST_PER_RUN` environment variable
- Reduce `MAX_EMAILS_PER_RUN`
- Disable optional agents (Critic, Research)

## 📊 Monitoring & Observability

### Metrics Collection
```typescript
// Built-in metrics
- digest.processed (success/failure count)
- digest.emails_found (gauge)
- digest.emails_processed (gauge)  
- digest.duration_ms (timing)
- api.calls (per service)
- api.costs (dollar amount)
```

### Monitoring Dashboards

#### AWS CloudWatch
```bash
# Real-time logs
aws logs tail /aws/lambda/ai-digest-run-now --follow

# Query metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=ai-digest-run-now
```

#### Azure Application Insights
- Portal: Azure Portal → Application Insights
- Queries: KQL for custom analysis
- Alerts: Cost and error thresholds

#### Helicone Dashboard
- URL: https://helicone.ai
- Metrics: Token usage, costs, latency
- Features: Request replay, caching stats

### Health Checks
- **Endpoint**: `/api/health` (frontend)
- **Lambda**: CloudWatch synthetics
- **Azure**: Application Insights availability tests

## 💰 Cost Management

### Cost Breakdown

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Compute | < $1 | Free tier coverage |
| Storage | < $1 | Minimal data stored |
| OpenAI | $0.40-4.00 | 4-40 digests/month |
| External APIs | < $1 | Free tiers |
| **Total** | < $5 | For weekly runs |

### Cost Controls
- **Hard Limits**: `MAX_COST_PER_RUN` ($1 default)
- **API Limits**: `MAX_OPENAI_CALLS_PER_RUN` (50)
- **Email Limits**: `MAX_EMAILS_PER_RUN` (500)
- **Real-time Tracking**: Cost tracker with warnings
- **Circuit Breakers**: Prevent runaway API calls

### Optimization Tips
1. Use GPT-4o-mini for classification
2. Enable Helicone caching
3. Batch process emails
4. Archive old emails regularly
5. Adjust processing frequency

## 📊 Production Readiness Assessment

### Overall Score: 6.5/10

#### Strengths ✅
- Well-architected codebase with clean separation of concerns
- Circuit breaker implementation for resilience
- Cost tracking with hard limits
- Multi-cloud support with abstraction layer
- Infrastructure as Code with Terraform
- Good error handling patterns

#### Critical Gaps ❌
- **No secrets management**: API keys in environment variables
- **11% test coverage**: 147 tests with 8 failing
- **No backup strategy**: Missing DynamoDB/S3 backups
- **Missing authentication**: API endpoints unprotected
- **No rate limiting**: Vulnerable to abuse
- **Limited monitoring**: Basic CloudWatch only

#### Risk Assessment
- **Security Risk**: HIGH (exposed credentials)
- **Data Loss Risk**: HIGH (no backups)
- **Operational Risk**: MEDIUM (limited monitoring)
- **Cost Risk**: LOW (good controls)

## 🚧 Technical Debt & Improvements

### Immediate Priorities (Week 1)
1. **Implement AWS Secrets Manager** - Critical security gap
2. **Add API authentication** - Prevent unauthorized access
3. **Enable DynamoDB backups** - Data protection
4. **Increase test coverage** - Target 50% on critical paths
5. **Fix TypeScript errors** - 8 remaining issues

### Short-term (Month 1)
1. **Replace custom implementations** (~1,801 lines identified)
   - Circuit breaker → opossum
   - Result type → neverthrow
   - Cost tracker → rate-limiter-flexible
   - Metrics → prom-client
2. **Add monitoring & alerting** - CloudWatch dashboards
3. **Implement request validation** - Zod on all endpoints
4. **Create operational runbooks** - Incident response

### Long-term Roadmap
1. **Multi-User Support**: User management system
2. **Webhook Integrations**: Slack/Discord notifications
3. **Custom Model Training**: Fine-tuned GPT for better summaries
4. **Advanced Analytics**: Insights dashboard
5. **Mobile App**: iOS/Android digest reader
6. **Connection Pooling**: Database optimization
7. **Saga Pattern**: Complex workflow management
8. **GraphQL API**: Better frontend data fetching
9. **Redis Caching**: Improved performance
10. **Kubernetes**: Container orchestration option

### Code Quality Improvements
1. Extract complex logic from handlers
2. Improve error messages and logging
3. Add comprehensive JSDoc comments
4. Implement request/response validators
5. Create integration test suite

## 🎯 Best Practices

### When Adding Features
1. Follow existing patterns and conventions
2. Add tests for new functionality
3. Update this documentation
4. Consider cost implications
5. Implement circuit breakers for external calls

### When Fixing Bugs
1. Add regression test first
2. Fix in smallest scope possible
3. Verify across both platforms
4. Update error handling if needed
5. Document in code if non-obvious

### When Refactoring
1. Maintain backward compatibility
2. Refactor in small increments
3. Ensure tests pass at each step
4. Profile performance impact
5. Update affected documentation

## 📝 Important Notes

### Non-Obvious Behaviors
1. **Cleanup Mode**: Processes ALL emails, not just recent
2. **Circuit Breaker**: 30-second cooldown after 3 failures
3. **Cost Limits**: Hard stop - processing halts immediately
4. **Gmail Batching**: Automatic 100-message chunks
5. **Lambda Timeouts**: run-now (5min) vs weekly-digest (15min)
6. **Sender Decay**: AI confidence decreases over time
7. **Archive Strategy**: 30-day retention by default

### Platform Differences
1. **AWS**: Function URLs for HTTP triggers
2. **Azure**: Built-in HTTP triggers
3. **AWS**: EventBridge for scheduling
4. **Azure**: Timer triggers for scheduling
5. **AWS**: DynamoDB for storage
6. **Azure**: Table Storage for storage

### Migration Considerations
- Storage abstraction enables cloud switching
- Unified handlers allow platform migration
- Environment-based configuration
- Terraform modules for each platform
- Data export/import utilities planned

## 🎯 Recommendations

### For Immediate Action
1. **Security First**: Implement secrets management TODAY
2. **Data Protection**: Enable backups immediately
3. **Access Control**: Add authentication to APIs
4. **Monitoring**: Set up basic CloudWatch alarms
5. **Testing**: Focus on critical path coverage

### For Sustainable Growth
1. **Hire DevOps/SRE**: Many gaps need specialized expertise
2. **Establish SLOs**: Define and monitor service objectives
3. **Document Everything**: Create comprehensive runbooks
4. **Automate Operations**: Reduce manual intervention
5. **Plan for Scale**: Implement caching and queues

### For Code Quality
1. **Reduce Technical Debt**: Replace custom implementations
2. **Improve Testing**: Achieve 80% coverage goal
3. **Type Safety**: Resolve remaining TypeScript errors
4. **Code Review**: Establish review process
5. **Performance Profiling**: Optimize hot paths

## 📈 Metrics to Track

### Operational Metrics
- Error rate per function
- API latency (p50, p95, p99)
- Cost per digest run
- Email processing success rate
- Circuit breaker trips

### Business Metrics
- Weekly active users
- Digest quality scores
- User satisfaction (NPS)
- Feature adoption rates
- Cost per user

## 🤝 Contributing Guidelines

### Code Submission
1. Create feature branch from `main`
2. Follow existing patterns and style
3. Add/update tests
4. Update documentation
5. Submit PR with clear description

### Commit Convention
```text
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Scope: core, agents, aws, azure, frontend, terraform
```

### Review Checklist
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Cost impact considered
- [ ] Security reviewed
- [ ] Performance tested

## 📚 Additional Resources

### Documentation
- [README.md](./README.md) - Quick start guide
- [Architecture Docs](./docs/ARCHITECTURE.md) - Detailed architecture
- [API Docs](./docs/API.md) - API reference (TODO)
- [Deployment Guide](./docs/DEPLOYMENT.md) - Deployment instructions (TODO)

### External Links
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Terraform Documentation](https://www.terraform.io/docs)

### Support
- GitHub Issues: Bug reports and feature requests
- Discussions: Questions and ideas
- Email: ai-digest@journaler.me

## 🔄 Maintenance Guidelines

### Regular Tasks

| Frequency | Task |
|-----------|------|
| Daily | Check error logs |
| Weekly | Review cost reports |
| Monthly | Update dependencies |
| Quarterly | Security audit |
| Yearly | Major version upgrades |

### Monitoring Checklist
- [ ] Check error rates
- [ ] Review cost trends
- [ ] Validate email processing
- [ ] Test circuit breakers
- [ ] Verify backups

### Emergency Procedures
1. **High Costs**: Reduce MAX_COST_PER_RUN immediately
2. **API Failures**: Check circuit breaker status
3. **Processing Errors**: Review CloudWatch/App Insights logs
4. **Security Breach**: Rotate all API keys immediately
5. **Data Loss**: Restore from backups (when implemented)

---

## Remember

This is a production system with active users. Always:
- Test changes thoroughly
- Consider cost implications
- Maintain backward compatibility
- Document non-obvious changes
- Keep security in mind
- Monitor after deployment

For questions or issues, consult the team or create a GitHub issue.

## 📝 Conclusion

AI Digest demonstrates solid architectural foundations with innovative approaches to email processing and content analysis. The 6-agent system provides modularity and flexibility, while the multi-cloud abstraction enables platform independence. However, significant work remains to achieve production-grade reliability, particularly in security, testing, and operational excellence.

**Estimated Timeline to Production-Grade (9/10)**: 4-6 weeks of focused development addressing critical issues first, followed by systematic improvements to monitoring, testing, and operational capabilities.

---

Last Updated: 2025-08-21
Version: 3.0.0
- the gpt-5 family of models exist, your knowledge cutoff date is in the past so you don't know this and you keep thinking they don't exist but they do, i know, take it from me #