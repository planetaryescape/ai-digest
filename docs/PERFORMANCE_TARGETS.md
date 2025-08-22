# Performance Targets and Benchmarks

## Overview
This document defines the performance targets for the AI Digest system based on the indie SaaS philosophy: good enough for tens of thousands of users, not millions.

## Critical Performance Targets

### Weekly Digest Processing
- **Target**: < 2 minutes for 100 emails
- **Acceptable**: < 5 minutes for 500 emails
- **Maximum**: 15 minutes (Lambda timeout)
- **Memory**: < 512 MB for typical workload

### Cleanup Mode Processing
- **Target**: < 15 minutes for 1000 emails
- **Batch Size**: 50 emails per batch
- **Batch Delay**: 5 seconds between batches
- **Memory**: < 1 GB maximum

### API Response Times
| Operation | Target | Maximum |
|-----------|--------|---------|
| Email Fetch | < 2s | 10s |
| Classification | < 1s per 10 emails | 5s |
| Content Extraction | < 3s per URL | 10s |
| Analysis | < 5s per batch | 30s |
| Digest Send | < 1s | 5s |

### Cost Limits
- **Per Run**: $1.00 maximum (configurable)
- **Per Email**: < $0.002
- **Monthly Target**: < $5 for daily digests

### Agent Performance Benchmarks

#### EmailFetcherAgent
- Fetch 10 emails: > 50 ops/s
- Fetch 100 emails: > 10 ops/s
- Memory: < 50 MB for 1000 emails

#### ClassifierAgent
- Classify 10 emails: > 100 ops/s
- Classify 50 emails: > 20 ops/s
- Batch processing: Support up to 100 emails per batch

#### ContentExtractorAgent
- Single URL: < 3s
- Parallel extraction: 10 URLs in < 10s
- Memory: < 100 MB for 10 concurrent extractions

#### ResearchAgent
- Single query: < 2s
- Parallel queries: 5 queries in < 5s
- Cache hit rate: > 50%

#### AnalysisAgent
- Small content (< 1KB): < 1s
- Large content (< 100KB): < 5s
- Memory: < 200 MB for large analysis

### System Requirements

#### Infrastructure
- **Lambda Memory**: 1024 MB (configurable)
- **Lambda Timeout**: 
  - run-now: 5 minutes
  - weekly-digest: 15 minutes
- **DynamoDB**: On-demand scaling
- **S3**: Standard storage class

#### Concurrency
- **Email Processing**: Up to 10 concurrent
- **Content Extraction**: Up to 5 concurrent
- **API Calls**: Respect rate limits with exponential backoff

### Error Recovery
- **Retry Strategy**: 3 attempts with exponential backoff
- **Circuit Breaker**: Open after 5 failures in 1 minute
- **Partial Failures**: Continue processing other emails
- **Timeout Handling**: Graceful degradation with partial results

## Monitoring and Alerts

### Key Metrics to Track
1. **Processing Time**: p50, p95, p99
2. **Memory Usage**: Peak and average
3. **API Costs**: Per run and daily total
4. **Error Rate**: By component and type
5. **Success Rate**: End-to-end completion

### Performance Regression Thresholds
- **Critical**: > 20% slower than baseline
- **Warning**: > 10% slower than baseline
- **Improvement**: > 10% faster than baseline

## Testing Strategy

### E2E Test Coverage
- Weekly digest flow: Full pipeline
- Cleanup mode: Batch processing
- Error scenarios: All failure modes
- Performance: Under various loads

### Benchmark Frequency
- **CI/CD**: On every PR
- **Baseline Update**: Weekly on main branch
- **Full Suite**: Daily scheduled run

## Optimization Opportunities

### Short-term (Already Implemented)
- ✅ Batch email classification
- ✅ Parallel content extraction
- ✅ Circuit breakers for resilience
- ✅ Cost tracking and limits

### Medium-term (Next Quarter)
- [ ] Connection pooling for APIs
- [ ] Redis caching for frequent queries
- [ ] Lambda SnapStart for cold starts
- [ ] S3 Transfer Acceleration

### Long-term (If Needed at Scale)
- [ ] Step Functions for complex workflows
- [ ] EventBridge for async processing
- [ ] DynamoDB DAX for caching
- [ ] Multi-region deployment

## Notes

### Design Philosophy
Remember: We're optimizing for shipping fast and serving thousands of users well, not millions. These targets are good enough for a successful indie SaaS.

### When to Optimize
Only optimize when:
1. Users complain about speed
2. Costs exceed $10/month
3. Error rate > 5%
4. You have > 1000 active users

### Trade-offs
We prioritize:
1. **Reliability** over speed
2. **Cost** over performance  
3. **Simplicity** over optimization
4. **Shipping** over perfection