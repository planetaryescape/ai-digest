# AI Digest

## Indie Context

Indie SaaS in validation. Target: tens of thousands of users, not millions. Ship fast, validate, iterate; working features over perfect code. Currently a personal automation tool with SaaS potential.

## Money Feature

The weekly digest is what users pay for; it has to work.

**Core**: Automated weekly digest turns AI/tech newsletters into actionable insights
- Fetches Gmail → Classifies AI content → Extracts articles → Analyzes with GPT → Sends digest
- Critical path: Gmail fetch → OpenAI analysis → Email delivery

**Key files**:
- `functions/core/digest-processor.ts` - Main orchestrator
- `functions/lib/agents/AnalysisAgent.ts` - Core value generation
- `functions/lib/email.ts` - Digest delivery
- `emails/WeeklyDigestRedesigned.tsx` - React Email template

**Dependencies**: Gmail API, OpenAI (models in `functions/lib/config.ts`), Resend for email

## Quick Start

```bash
bun install
bun run generate:oauth   # Gmail OAuth token
cp .env.example .env     # Add: Gmail OAuth, OpenAI API key, Resend API key
bun run deploy:aws       # Build + terraform apply
curl https://your-function-url/run-now
```

## Commands

```bash
bun run lint:check        # Biome (bun run lint also writes fixes)
bun run typecheck
bun run test              # Vitest
bun run test:fast         # Skip *.integration.test.ts
bun run test:e2e          # Playwright
bun run dev:email         # React Email preview
bun run health:gmail      # Hit the deployed gmail-health endpoint
bun run refresh:gmail     # Refresh Gmail token
```

## Architecture Overview

Monolithic serverless design:

```
Gmail → Lambda Functions → OpenAI → Email
         ↓
      DynamoDB (tracking)
```

**6-Agent Pipeline** (`functions/lib/agents/`):
1. **EmailFetcher**: Gmail fetching with batching
2. **Classifier**: Batch AI/non-AI classification
3. **ContentExtractor**: Article extraction via Firecrawl
4. **Research**: Web enrichment via Brave Search
5. **Analysis**: Deep analysis (the money step)
6. **Critic**: Opinionated commentary

**Resilience**:
- Circuit breakers on external APIs
- Hard cost limit ($1/run)
- Graceful degradation when services fail

## Development Guidelines

### Priority Order
1. Fix anything that breaks email analysis (the money feature)
2. Fix digest delivery issues
3. Fix cost overruns
4. Ship user-requested features
5. Improve test coverage
6. Everything else is optional

### What to Ignore
- Microservices architecture (monolith works fine)
- Perfect test coverage (ship features instead)
- Complex CI/CD (simple deploy script works)
- Scaling to millions (worry at 10K users)

### Issue Tracking with Beads
Use [beads](https://github.com/steveyegge/beads) for issue tracking. Tasks live in `.beads/` as JSONL.

```bash
bd ready             # List unblocked tasks
bd create "Title"    # New task
bd show <id>         # Task details
bd dep add <a> <b>   # Add dependency
```

## Known Problems

- `functions/lib/gmail.ts` has unimplemented TODOs (sender tracking, AI classification, batch classification).
- `functions/lib/pipeline/QueueClient.ts` is a stub until `@aws-sdk/client-sqs` is added.

### Tech Debt
1. Both `opossum` and custom `circuit-breaker.ts` exist - consolidate
2. Both `neverthrow` and custom `functions/lib/types/Result.ts` exist - consolidate
3. Email template in `email.ts` duplicates `WeeklyDigestRedesigned.tsx`

## Tech Stack & Services

- **Runtime**: Node.js 20 + TypeScript, Bun for packages and scripts
- **Cloud**: AWS (Lambda, DynamoDB, S3, Secrets Manager), Terraform in `terraform/aws/`
- **Email**: React Email + Tailwind CSS, Resend
- **Frontend**: Next.js in `frontend/`, Clerk auth (`frontend/middleware.ts`)
- **Optional services**: Firecrawl (article extraction), Brave Search (research), Helicone (API monitoring)

## Deployment & Operations

```bash
bun run deploy:aws                          # Full deploy with infrastructure
bun run update:aws                          # Quick code update (no Terraform)
bun run functions/handlers/aws/run-now.ts   # Test locally
```

### Lambda Functions
| Function | Timeout | Purpose | Trigger |
|----------|---------|---------|---------|
| run-now | 30 s | Manual digest; invokes weekly-digest | API/Dashboard |
| weekly-digest | 5 min | Scheduled digest + cleanup | EventBridge `cron(0 10 ? * SUN,THU *)` |

`terraform/aws/pipeline*.tf` also define a queue-based pipeline (email-fetcher, classifier, content-extractor, ...).

### Cost Controls
Limits live in `COST_LIMITS` in `functions/lib/constants.ts`: $1/run, 500 emails/run, 50 OpenAI calls/run. Typical cost ~$0.10/digest.

### Monitoring
```bash
aws logs tail /aws/lambda/ai-digest-run-now --follow
```
Costs: Helicone dashboard. Errors: CloudWatch Insights.

## Common Issues & Solutions

### High OpenAI costs
Lower `MAX_EMAILS_PER_RUN` in `functions/lib/constants.ts` or disable optional agents.

### Gmail rate limits
Handled with batching; tune `GMAIL_BATCH_DELAY_MS` in `functions/lib/constants.ts`.

### TypeScript build errors
Use `async function<T>()` not arrow functions for generics.

## Visual Development

Shipping to validate, not to win design awards. All UI work happens in `frontend/`. Care most about the digest email, first-time onboarding, the digest dashboard and error states; everything else just needs to not be broken. Checklists: `context/design-principles.md` and `context/style-guide.md`.

## Session Completion

Work is done when it is pushed, so beads state reaches the remote with it:

1. File beads issues for remaining follow-up work
2. Run quality gates if code changed (tests, lint, build)
3. Update issue status
4. `git pull --rebase && bd sync && git push`, then confirm `git status` is up to date with origin
