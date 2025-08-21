# AI Digest Monitoring & Observability

## Overview

The AI Digest system includes comprehensive monitoring dashboards and alarms for production observability. This monitoring infrastructure helps track system health, performance metrics, cost optimization, and agent-specific behaviors.

## Dashboards

### 1. Main Dashboard (`ai-digest-main-dashboard`)

The primary operational dashboard provides real-time visibility into system performance:

- **Lambda Execution Overview**: Total invocations, errors, and throttles
- **Execution Duration**: Average, maximum, and minimum duration metrics
- **Function-Specific Performance**: Comparison between Weekly Digest and Run Now functions
- **Error Rates**: Error tracking by function with visual thresholds
- **Memory Utilization**: Memory usage percentages and peaks
- **DynamoDB Operations**: Read/write capacity consumption and errors
- **S3 Storage Operations**: Request metrics and error rates
- **Concurrent Executions**: Track concurrent Lambda executions against limits
- **API Gateway Metrics**: Request counts and error rates
- **API Gateway Latency**: Average and p99 latency tracking
- **Recent Error Logs**: Real-time error log monitoring

### 2. Cost Dashboard (`ai-digest-cost-dashboard`)

Dedicated dashboard for tracking operational costs:

- **Estimated Lambda Costs**: Daily cost calculations based on duration and invocations
- **DynamoDB Consumed Capacity**: Tracking read/write capacity units
- **S3 Storage Usage**: Storage size and object count metrics
- **API Gateway Usage**: Request counts with cost estimates
- **Lambda Invocation Trends**: 7-day historical view of invocation patterns

### 3. Agents Dashboard (`ai-digest-agents-dashboard`)

Specialized monitoring for the agent-based architecture:

- **Agent Performance Overview**: Documentation and key metrics explanation
- **Circuit Breaker Activations**: Real-time circuit breaker state changes
- **Agent Processing Times**: Average and maximum duration by agent
- **OpenAI API Cost Tracking**: Real-time cost monitoring for GPT calls
- **External API Errors**: Error rates for Gmail, OpenAI, Firecrawl, Brave, and Resend APIs
- **Email Processing Volume**: Hourly email processing metrics

## CloudWatch Alarms

Automated alerts for critical system conditions:

### Lambda Function Alarms
- **Lambda Errors**: Triggers when errors exceed 5 in 10 minutes
- **Lambda Throttles**: Alerts on any throttling events
- **Lambda Duration**: Warns when execution exceeds 4 minutes

### API Gateway Alarms
- **4XX Errors**: Triggers when client errors exceed 10 in 10 minutes
- **5XX Errors**: Alerts when server errors exceed 5 in 5 minutes

### DynamoDB Alarms
- **User Errors**: Alerts when DynamoDB errors exceed 5 in 10 minutes

## Deployment

### Prerequisites
- AWS CLI configured with appropriate credentials
- Terraform installed (version 1.0+)
- Existing AI Digest infrastructure deployed

### Deploy Monitoring Infrastructure

```bash
# Use the automated deployment script
./scripts/deploy-monitoring.sh

# Or deploy manually with Terraform
cd terraform/aws
terraform apply -target=module.monitoring
```

### Verify Deployment

After deployment, access your dashboards:
1. Navigate to AWS CloudWatch Console
2. Select "Dashboards" from the left menu
3. Find your dashboards prefixed with your project name

## Custom Metrics Integration

The monitoring system integrates with the existing metrics collection in `functions/lib/metrics.ts`:

```typescript
// Example metric emissions
metrics.emailsProcessed(count);
metrics.digestGenerated(emailCount, duration);
metrics.error('error_type', { agent: 'EmailFetcherAgent' });
```

These metrics are automatically collected and displayed in the dashboards.

## Cost Optimization

The cost dashboard helps identify optimization opportunities:

### Key Metrics to Watch
- **Lambda Duration**: Optimize long-running functions
- **DynamoDB Capacity**: Right-size provisioned capacity
- **S3 Storage**: Implement lifecycle policies for old data
- **API Gateway Requests**: Monitor for unusual spikes

### Cost Reduction Strategies
1. **Optimize Lambda Memory**: Lower memory allocation where possible
2. **Reduce Function Duration**: Optimize code for faster execution
3. **Implement Caching**: Reduce redundant API calls
4. **Use Reserved Capacity**: For predictable workloads

## Troubleshooting

### Common Issues

#### Missing Metrics
- Ensure Lambda functions have CloudWatch Logs permissions
- Verify S3 bucket metrics filter is enabled
- Check that functions are actually being invoked

#### Dashboard Not Loading
- Verify AWS region matches deployment region
- Check IAM permissions for CloudWatch access
- Ensure all referenced resources exist

#### Alarms Not Triggering
- Review alarm thresholds and adjust if needed
- Check "Treat Missing Data" settings
- Verify metrics are being published

### Log Analysis Queries

Use CloudWatch Insights for advanced analysis:

```sql
-- Find slowest agent operations
fields @timestamp, @message
| filter @message like /Agent.*duration/
| parse @message /(?<agent>\w+Agent).*duration.*?(?<duration>\d+)/
| sort duration desc
| limit 10

-- Track cost per digest
fields @timestamp, @message
| filter @message like /digest.*generated/
| parse @message /cost.*?(?<cost>[\d.]+)/
| stats sum(cost) as total_cost by bin(1h)
```

## Alerting Configuration

### Setting Up SNS Notifications

1. Create SNS Topic:
```bash
aws sns create-topic --name ai-digest-alerts
```

2. Subscribe to alerts:
```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:region:account:ai-digest-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

3. Update alarms to use SNS:
```terraform
alarm_actions = [aws_sns_topic.alerts.arn]
```

## Best Practices

### Dashboard Organization
- Keep dashboards focused on specific aspects (operations, costs, agents)
- Use consistent time ranges across widgets
- Include both real-time and historical views

### Alarm Configuration
- Set realistic thresholds based on baseline metrics
- Use evaluation periods to reduce false positives
- Document alarm response procedures

### Cost Management
- Review cost dashboard weekly
- Set up billing alerts for unexpected charges
- Optimize based on actual usage patterns

## Metrics Reference

### Standard AWS Metrics
- `AWS/Lambda/Invocations`: Function invocation count
- `AWS/Lambda/Duration`: Execution time in milliseconds
- `AWS/Lambda/Errors`: Function errors
- `AWS/Lambda/Throttles`: Throttled invocations
- `AWS/DynamoDB/ConsumedReadCapacityUnits`: DynamoDB read usage
- `AWS/S3/AllRequests`: S3 API requests

### Custom Application Metrics
- `emails.processed`: Number of emails processed
- `digest.generated`: Digest generation events
- `api.<service>.<operation>`: External API call metrics
- `circuit.breaker.state`: Circuit breaker state changes
- `agent.<name>.duration`: Agent-specific processing times

## Integration with Helicone

The system includes Helicone API key configuration for enhanced OpenAI monitoring:

1. Access Helicone dashboard: https://helicone.ai
2. View detailed OpenAI usage metrics
3. Set up cost alerts in Helicone
4. Export data for analysis

## Maintenance

### Regular Tasks
- **Daily**: Check error rates and alarms
- **Weekly**: Review cost trends and optimization opportunities
- **Monthly**: Analyze performance patterns and adjust thresholds
- **Quarterly**: Review and update dashboard layouts

### Dashboard Updates
To modify dashboards, update `terraform/aws/monitoring.tf` and redeploy:

```bash
terraform plan
terraform apply
```

## Support

For monitoring issues:
1. Check CloudWatch service health
2. Verify IAM permissions
3. Review deployment logs
4. Check AWS service limits

## Future Enhancements

Planned improvements for monitoring:
- [ ] Azure Monitor integration for multi-cloud visibility
- [ ] Custom metrics for email classification accuracy
- [ ] Predictive alerting based on ML models
- [ ] Integration with PagerDuty or similar for on-call
- [ ] Real-time cost anomaly detection
- [ ] Performance regression testing integration