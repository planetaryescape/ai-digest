# AWS Lambda Deployment - AI Digest

## 🚀 Complete Production-Ready Infrastructure

This directory contains a **comprehensive, production-ready** AWS infrastructure for the AI Digest system.

## ✅ What's Included

### Core Infrastructure
- **Lambda Functions**: Weekly digest processing and manual trigger
- **S3 Storage**: Dual-purpose buckets for deployment packages and processed email tracking
- **API Gateway**: RESTful API with rate limiting and API key authentication
- **EventBridge**: Scheduled weekly triggers (Sundays at 9 AM UTC)

### Security & Permissions
- **Comprehensive IAM Roles**: All required permissions properly scoped
  - CloudWatch Logs read/write
  - S3 bucket operations (get, put, delete, list)
  - Lambda invocation permissions
  - X-Ray tracing support
  - KMS encryption support
- **Bucket Security**: Public access blocked, server-side encryption enabled
- **API Security**: API key required, usage plans with quotas

### Monitoring & Observability
- **CloudWatch Dashboard**: Complete metrics visualization
- **CloudWatch Alarms**: 
  - Lambda errors
  - Duration warnings (80% of timeout)
  - Throttling detection
  - Dead letter queue monitoring
- **Structured Logging**: All functions use structured logging
- **X-Ray Tracing**: Optional distributed tracing support

### Error Handling
- **Dead Letter Queue**: Automatic retry and failure capture
- **Retry Policies**: Configurable retry with exponential backoff
- **Error Notifications**: SNS topic for critical alerts
- **Graceful Degradation**: Non-critical errors don't stop processing

### Email Features
- **Gmail Links**: Every source email includes a direct Gmail link
- **Sources Section**: Complete list of all processed newsletters
- **Rich HTML Email**: Beautiful, responsive email template
- **Plain Text Fallback**: For email clients that don't support HTML

## 📁 File Structure

```
terraform/aws/
├── main-complete.tf          # Complete infrastructure definition
├── variables-complete.tf     # All configuration variables
├── cloudwatch-dashboard.tf   # Monitoring dashboard
├── terraform.tfvars          # Your configuration (git-ignored)
└── README.md                 # This file
```

## 🔧 Deployment

### Prerequisites
- AWS CLI configured with credentials
- Terraform installed (>= 1.0)
- Node.js 20.x installed
- Gmail OAuth credentials configured
- OpenAI API key
- Resend API key

### Quick Deploy

```bash
# 1. Build Lambda functions
cd ~/code/planetaryescape/ai-digest
npm run build:aws

# 2. Configure variables
cd terraform/aws
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your configuration

# 3. Deploy infrastructure
./deploy-aws.sh
```

### Using Complete Configuration

To use the production-ready configuration:

```bash
# Replace simplified config with complete config
cd terraform/aws
mv main.tf main-simple.tf
cp main-complete.tf main.tf
cp variables-complete.tf variables.tf

# Initialize and deploy
terraform init
terraform plan
terraform apply
```

## 🔑 Secrets Management

After deploying the infrastructure, you need to populate the secrets in AWS Secrets Manager:

### Option 1: Via AWS Console
1. Navigate to AWS Secrets Manager in the AWS Console
2. Find the secret named `${PROJECT_NAME}-api-keys`
3. Click "Retrieve secret value" → "Edit"
4. Update the JSON with your actual API keys:
```json
{
  "gmail_client_id": "your-actual-gmail-client-id",
  "gmail_client_secret": "your-actual-gmail-client-secret",
  "gmail_refresh_token": "your-actual-gmail-refresh-token",
  "openai_api_key": "your-actual-openai-api-key",
  "helicone_api_key": "your-actual-helicone-api-key",
  "resend_api_key": "your-actual-resend-api-key",
  "resend_from": "your-email@example.com"
}
```

### Option 2: Via AWS CLI
```bash
aws secretsmanager update-secret \
  --secret-id ai-digest-api-keys \
  --secret-string '{
    "gmail_client_id": "your-actual-gmail-client-id",
    "gmail_client_secret": "your-actual-gmail-client-secret",
    "gmail_refresh_token": "your-actual-gmail-refresh-token",
    "openai_api_key": "your-actual-openai-api-key",
    "helicone_api_key": "your-actual-helicone-api-key",
    "resend_api_key": "your-actual-resend-api-key",
    "resend_from": "your-email@example.com"
  }'
```

### Important Notes:
- Secrets are loaded at Lambda cold start and cached for performance
- If Secrets Manager is unavailable, functions will fall back to environment variables
- Rotate secrets regularly using AWS Secrets Manager rotation feature
- Cost: ~$0.40/month for the secret storage

## 🔐 Required Permissions

Your AWS user/role needs these permissions:
- **IAM**: Create roles and policies
- **Lambda**: Create and manage functions
- **S3**: Create and manage buckets
- **CloudWatch**: Create log groups, alarms, dashboards
- **EventBridge**: Create scheduled rules
- **API Gateway**: Create REST APIs
- **SNS**: Create topics and subscriptions
- **SQS**: Create queues (for DLQ)
- **Secrets Manager**: (Optional) Store credentials
- **DynamoDB**: (Optional) If using DynamoDB storage

## 📊 Monitoring

### CloudWatch Dashboard
Access your dashboard at:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ai-digest
```

### Metrics Tracked
- Lambda invocations and errors
- API Gateway requests and latency
- Memory utilization
- Dead letter queue messages
- Processing duration

### Alarms
Email alerts are sent for:
- Lambda function errors (>5 in 5 minutes)
- Long execution times (>80% of timeout)
- Throttling events
- Messages in dead letter queue

## 🧪 Testing

### Test Lambda Function
```bash
aws lambda invoke \
  --function-name ai-digest-weekly-digest \
  --region us-east-1 \
  output.json
```

### Test API Endpoint
```bash
# Get API key
aws apigateway get-api-key \
  --api-key YOUR_KEY_ID \
  --include-value \
  --region us-east-1

# Call API
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/run \
  -H "x-api-key: YOUR_API_KEY"
```

## 📧 Email Sources Feature

The digest now includes a comprehensive sources section with:
- Direct Gmail links for each processed email
- Sender information and dates
- One-click access to archived emails
- All emails listed for transparency

Example:
```
📧 Email Sources
This digest was generated from 39 AI newsletters. Click any email below to view it in Gmail:

1. The Batch: AI News & Insights - From: DeepLearning.AI • 12/15/2024
   Link: https://mail.google.com/mail/u/0/#inbox/18abc123def

2. AI Weekly - From: VentureBeat • 12/14/2024
   Link: https://mail.google.com/mail/u/0/#inbox/18abc456ghi
```

## 🔄 Configuration Options

### Environment Variables
All Lambda functions support these environment variables:
- `STORAGE_TYPE`: "s3" or "dynamodb"
- `NODE_ENV`: "development", "staging", "production"
- `LOG_LEVEL`: "DEBUG", "INFO", "WARN", "ERROR"
- `ENABLE_XRAY`: "true" or "false"

### Terraform Variables
Key configuration options in `terraform.tfvars`:
```hcl
# Core settings
aws_region    = "us-east-1"
environment   = "production"
lambda_timeout = 300  # 5 minutes
lambda_memory  = 512  # MB

# Schedule
schedule_expression = "cron(0 9 ? * SUN *)"  # Weekly Sunday 9 AM UTC
enable_schedule     = true

# Monitoring
alert_email        = "alerts@example.com"
log_retention_days = 7
enable_xray        = false

# Storage
use_dynamodb        = false  # Use S3 by default
use_secrets_manager = false  # Use env vars by default
```

## 🛡️ Security Best Practices

1. **Never commit secrets** - Use terraform.tfvars (git-ignored)
2. **Use Secrets Manager** in production - Set `use_secrets_manager = true`
3. **Enable encryption** - Set `kms_key_id` for CloudWatch logs
4. **Monitor access** - Review CloudWatch logs regularly
5. **Rotate credentials** - Update OAuth tokens periodically

## 🚨 Troubleshooting

### Lambda Errors
Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/ai-digest-weekly-digest --follow
```

### Permission Issues
Ensure your AWS user has all required permissions. Use the complete IAM configuration in `main-complete.tf`.

### Gmail API Issues
- Verify OAuth credentials are valid
- Check refresh token hasn't expired
- Ensure Gmail API is enabled in Google Cloud Console

## 📝 Maintenance

### Update Lambda Code
```bash
npm run build:aws
cd terraform/aws
terraform apply -target=aws_s3_object.lambda_package
terraform apply -target=aws_lambda_function.weekly_digest
terraform apply -target=aws_lambda_function.run_now
```

### Clean Up Old Data
S3 lifecycle rules automatically delete:
- Old Lambda versions after 30 days
- Processed email records after 90 days

### Destroy Infrastructure
```bash
terraform destroy
```

## 🎉 Features Summary

✅ **Production-Ready**: Complete error handling, monitoring, and security
✅ **Gmail Integration**: Direct links to source emails
✅ **Multi-Storage**: Support for S3 or DynamoDB
✅ **Auto-Scaling**: Lambda scales automatically
✅ **Cost-Optimized**: Pay only for what you use
✅ **Fully Monitored**: Dashboard, alarms, and notifications
✅ **Secure**: Encrypted, authenticated, and properly scoped
✅ **Maintainable**: Clear structure, good documentation

## 📞 Support

For issues or questions:
1. Check CloudWatch logs for errors
2. Review the CloudWatch dashboard
3. Check the dead letter queue for failed messages
4. Enable debug logging with `LOG_LEVEL=DEBUG`