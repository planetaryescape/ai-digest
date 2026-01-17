# AI Digest Codebase Overview

## Indie Context

Indie SaaS rapid market validation

Target: tens of thousands users not millions
Philosophy: ship fast validate iterate
Priority: working features over perfect code
Stage: personal automation tool with SaaS potential

## Money Feature

CRITICAL: what users pay for MUST work perfectly

**Core**: Automated weekly digest transforms overwhelming AI/tech newsletters into actionable insights
- Fetches Gmail → Classifies AI content → Extracts articles → Analyzes with GPT → Sends beautiful digest
- Saves 2-3 hours/week newsletter reading, provides role-specific advice
- Critical path: Gmail fetch → OpenAI analysis → Email delivery

**Key files**:
- `functions/core/digest-processor.ts` - Main orchestrator (806 lines)
- `functions/lib/agents/AnalysisAgent.ts` - Core value generation
- `functions/lib/email.ts` - Digest delivery
- `emails/WeeklyDigestRedesigned.tsx` - Beautiful React Email template

**Dependencies**: Gmail API, OpenAI GPT-4o/5, Resend for email
**Failure impact**: No digest = no value = angry users

## Quick Start

```bash
# 1. Clone and install
git clone <repo>
cd ai-digest
bun install

# 2. Generate Gmail OAuth token
bun run generate:oauth

# 3. Configure environment
cp .env.example .env
# Add: Gmail OAuth, OpenAI API key, Resend API key

# 4. Deploy to AWS
bun run deploy:aws

# 5. Test it
curl https://your-function-url/run-now
```

Processing emails in < 5 minutes.

## Architecture Overview

**Simple monolithic serverless design** - Perfect for indie SaaS:

```
Gmail → Lambda Functions → OpenAI → Beautiful Email
         ↓
      DynamoDB (tracking)
```

**6-Agent Pipeline** (each specialized):
1. **EmailFetcher**: Smart Gmail fetching (70% API reduction)
2. **Classifier**: Batch AI/non-AI classification
3. **ContentExtractor**: Article extraction via Firecrawl
4. **Research**: Web enrichment via Brave Search
5. **Analysis**: Deep GPT-4o/5 analysis (THE MONEY STEP)
6. **Critic**: Opinionated commentary

**Resilience Built-in**:
- Circuit breakers on all external APIs
- Hard cost limit ($1/run default)
- Graceful degradation when services fail

## Development Guidelines

### Priority Order
1. **Fix anything that breaks email analysis** - This is the money feature
2. **Fix digest delivery issues** - Users must get their emails
3. **Fix cost overruns** - Keep it profitable
4. **Ship user-requested features** - Grow the product
5. **Improve test coverage** - Currently 11% (8 failing tests)
6. Everything else is optional

### What to Ignore
- Microservices architecture (monolith works fine)
- Perfect test coverage (ship features instead)
- Complex CI/CD (simple deploy script works)
- Scaling to millions (worry at 10K users)
- Minor TypeScript errors (20 remaining, not critical)

### Issue Tracking with Beads
Use [beads](https://github.com/steveyegge/beads) for issue tracking. Git-backed, agent-friendly.

```bash
bd init              # Setup (once)
bd ready             # List unblocked tasks
bd create "Title"    # New task
bd show <id>         # Task details
bd dep add <a> <b>   # Add dependency
```

Tasks stored in `.beads/` as JSONL. Hash IDs like `bd-a1b2`. Hierarchical: `bd-a3f8.1.1` (epic.task.subtask).

## Real Problems to Fix

### Critical (This Week)
1. **Failing tests** - 48 tests failing (104 passing)
   - Mostly digest-processor integration tests + token-manager tests
   - Root cause: Mock setup issues, Result type expectations
   - Files: `functions/core/digest-processor.test.ts`, `functions/lib/gmail/token-manager.test.ts`

2. **Frontend auth bypassed** - Clerk middleware commented out
   - All API routes unprotected, using hardcoded "demo-user"
   - Files: `frontend/middleware.ts`, `frontend/app/api/digest/trigger/route.ts`

3. **sendDigest not called in main flow** - TODOs in digest-processor.ts:274,533
   - Deep analysis pipeline builds digest but never sends it
   - Only simple/research fallback paths actually send

### Important (This Month)
1. **Many TODOs in gmail.ts** - Missing implementations
   - Sender tracking not implemented
   - AI classification not implemented
   - Batch classification not implemented

2. **QueueClient stub** - Pipeline queue client is entirely TODO
   - `functions/lib/pipeline/QueueClient.ts` - all methods return errors

### Already Fixed (Update Issue #85)
✅ **Secrets management implemented** - AWS Secrets Manager configured
- `terraform/aws/secrets.tf` - Secret created + IAM policy
- Lambda env vars use SECRET_ARN
- DynamoDB point-in-time recovery enabled

### Tech Debt (Later)
1. Both `opossum` and custom `circuit-breaker.ts` exist - consolidate
2. Both `neverthrow` and custom `Result.ts` exist - consolidate
3. Email template in `email.ts` duplicates `WeeklyDigestRedesigned.tsx`

## 💡 Quick Wins (Ship These Features)

### High Impact, Low Effort
1. **Add webhook notifications** (1 day)
   - Slack/Discord when digest sent
   - Simple POST to webhook URL

2. **Email preview mode** (2 hours)
   - Test digests without sending
   - Add `?preview=true` parameter

3. **Sender whitelist UI** (4 hours)
   - Let users mark favorite newsletters
   - Frontend already scaffolded

4. **Cost dashboard** (2 hours)
   - Show API costs per run
   - Data already tracked

### Medium Effort, High Value
1. **Multi-user support** (1 week)
   - Add user accounts to DynamoDB
   - Scope digests per user
   - Charge $5/month

2. **Custom digest schedules** (3 days)
   - Daily/weekly/monthly options
   - EventBridge rules per user

3. **Digest history** (2 days)
   - Store digests in S3
   - Browse past summaries

## Tech Stack & Services

### Core Stack
- **Runtime**: Node.js 20 + TypeScript
- **Package Manager**: Bun (way faster than npm)
- **Cloud**: AWS (Lambda, DynamoDB, S3)
- **Email**: React Email + Tailwind CSS
- **Auth**: Clerk (frontend only)

### External Services (Monthly Costs)
| Service | Purpose | Cost | Required? |
|---------|---------|------|-----------|
| Gmail API | Email fetching | Free | ✅ Yes |
| OpenAI | Analysis | ~$4/month | ✅ Yes |
| Resend | Email delivery | Free tier | ✅ Yes |
| Firecrawl | Article extraction | $0.001/URL | Optional |
| Brave Search | Research | Free tier | Optional |
| Helicone | API monitoring | Free tier | Optional |

### Key Files to Know
```
functions/
  core/digest-processor.ts      # Main brain - orchestrates everything
  lib/agents/*.ts               # 6 specialized agents
  lib/cost-tracker.ts          # Prevents bankruptcy
  lib/circuit-breaker-enhanced.ts # Resilience
  handlers/aws/run-now.ts      # Manual trigger endpoint

terraform/aws/main.tf          # Infrastructure as code
emails/WeeklyDigestRedesigned.tsx # Beautiful email template
frontend/app/api/             # API routes (needs auth!)
```

## Deployment & Operations

### Deploy Commands
```bash
# Full deploy with infrastructure
bun run deploy:aws

# Quick code update (no Terraform)
bun run update:aws

# Test locally
bun run functions/handlers/aws/run-now.ts
```

### Lambda Functions
| Function | Timeout | Purpose | Trigger |
|----------|---------|---------|---------|
| run-now | 5 min | Manual digest | API/Dashboard |
| weekly-digest | 15 min | Scheduled + cleanup | EventBridge Sunday 8am |

### Cost Controls
- **Hard limit**: $1/run (adjustable via `MAX_COST_PER_RUN`)
- **Email limit**: 500/run
- **OpenAI calls**: 50/run
- **Typical cost**: $0.10/digest

### Monitoring
```bash
# Check logs
aws logs tail /aws/lambda/ai-digest-run-now --follow

# Check costs
# Visit Helicone dashboard

# Check errors
# CloudWatch Insights queries
```

## Common Issues & Solutions

### "Weekly digest ARN not configured"
Old Lambda code. Run: `bun run update:aws`

### High OpenAI costs
Reduce `MAX_EMAILS_PER_RUN` or disable optional agents

### Gmail rate limits
Already handled with batching, but can adjust `GMAIL_BATCH_DELAY_MS`

### TypeScript build errors
Use `async function<T>()` not arrow functions for generics

## Metrics & Performance

### Current State
- **Codebase**: 33,032 lines TypeScript (functions: 18,058)
- **Tests**: 104 passing, 48 failing (68% pass rate)
- **TypeScript**: Clean (0 errors)
- **Processing Time**: 2-4 min (weekly), 5-15 min (cleanup)
- **Cost per Digest**: ~$0.10
- **API Efficiency**: 70% Gmail API reduction

### Production Readiness: 7/10
✅ Strengths:
- Core feature works reliably
- Good cost controls ($1/run limit)
- Secrets Manager implemented
- DynamoDB point-in-time recovery enabled
- Circuit breakers for resilience
- Beautiful React Email template

❌ Gaps:
- Test failures need fixing
- Frontend auth bypassed
- Main digest flow doesn't send email (TODO)
- Several gmail.ts TODOs unimplemented

## Next Steps for Growth

### Week 1 (Stability)
1. Fix sendDigest TODO in digest-processor.ts (main flow doesn't send!)
2. Fix failing tests (mock setup issues)
3. Enable Clerk auth middleware

### Month 1 (Polish & Features)
1. Consolidate circuit breaker (opossum vs custom)
2. Consolidate Result type (neverthrow vs custom)
3. Implement gmail.ts TODOs (sender tracking, classification)
4. Add webhook notifications

### Quarter 1 (Scale & Monetize)
1. Add billing with Stripe
2. User onboarding flow
3. Custom schedules per user
4. Marketing site
5. Launch on Product Hunt

## Visual Development

### Indie Design Philosophy
**REMEMBER: We're shipping to validate, not win design awards.**
- Good enough UX that doesn't frustrate users
- Clean, professional look without obsessing over pixels
- Focus on the money feature working beautifully (the digest email)
- Everything else just needs to not be broken

### Frontend Location
The frontend code is located in the `/frontend` directory - all UI/UX work happens there.

### Quick Visual Check
After implementing any front-end change in `/frontend`:
1. **Does it work?** - Test the actual functionality
2. **Does it look broken?** - Quick visual scan for obvious issues
3. **Is it usable?** - Can users figure it out without instructions?
4. **Take a screenshot** - Document what shipped
5. **Check console** - No errors breaking the experience

### When to Care More About Design
- The money feature (beautiful digest emails)
- First-time user experience/onboarding
- Dashboard for viewing/managing digests
- Error states that lose user trust

### Design Principles
- `/context/design-principles.md` - Pragmatic design checklist
- `/context/style-guide.md` - Basic brand consistency for frontend
- Use these as guidelines, not gospel

### Design Review (When Needed)
Use the design-review agent when:
- Shipping a major user-facing feature in `/frontend`
- The UI feels "off" and you need help
- Before a Product Hunt launch
- Customer reported UI/UX issues

Remember: Ship first, polish based on user feedback.

## Remember

**This is a working product that delivers value.** The code isn't perfect, but it:
- Processes emails reliably
- Saves users hours per week
- Costs < $5/month to run
- Has room to grow to 10K+ users

**Focus on**: Making the money feature bulletproof, fixing security issues, then shipping features users ask for.

**Ignore**: Enterprise patterns, perfect test coverage, complex architectures.

**Ship fast, get feedback, iterate.** You're building a business, not writing a computer science textbook.

---

Last Updated: 2026-01-16
Version: 4.1.0
Type: Indie SaaS in validation phase

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
