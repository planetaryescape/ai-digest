# AWS Lambda Deployment Guide

## Quick Update (Code Changes Only)

When you've made code changes and need to update the Lambda functions without changing infrastructure:

```bash
# Option 1: Using npm script
npm run update:aws

# Option 2: Manual steps
npm run build:aws
./scripts/deploy-lambda.sh

# Option 3: Using AWS CLI directly
npm run build:aws
aws lambda update-function-code \
  --function-name ai-digest-run-now \
  --zip-file fileb://terraform/artifacts/lambda.zip

aws lambda update-function-code \
  --function-name ai-digest-weekly-digest \
  --zip-file fileb://terraform/artifacts/lambda.zip
```

## Full Deployment (Infrastructure + Code)

For first-time deployment or infrastructure changes:

```bash
# 1. Set environment variables
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1

# 2. Initialize and deploy with Terraform
cd terraform/aws
terraform init
terraform apply

# This will create all resources and deploy the Lambda code
```

## Testing the Deployment

### Get API Gateway Details
```bash
cd terraform/aws
API_URL=$(terraform output -raw api_gateway_url)
API_KEY_ID=$(terraform output -raw api_key_id)
API_KEY=$(aws apigateway get-api-key --api-key $API_KEY_ID --include-value --query value --output text)
```

### Test Weekly Mode
```bash
curl -X POST $API_URL/run \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json"
```

### Test Cleanup Mode
```bash
curl -X POST "$API_URL/run?cleanup=true" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json"
```

## Viewing Logs

```bash
# View run-now logs
aws logs tail /aws/lambda/ai-digest-run-now --follow

# View weekly-digest logs
aws logs tail /aws/lambda/ai-digest-weekly-digest --follow

# View recent errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/ai-digest-run-now \
  --filter-pattern "ERROR"
```

## Common Issues

### "Weekly digest Lambda ARN not configured"
This means the Lambda is running old code. Update it:
```bash
npm run update:aws
```

### "Access Denied" errors
Check that the Lambda has the correct IAM permissions:
- Lambda invoke permissions (for run-now to call weekly-digest)
- S3 access (for storing processed emails)
- DynamoDB access (for tracking known senders)
- Secrets Manager access (if using secrets)

### "Function not found"
Make sure the Lambda functions exist:
```bash
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'ai-digest')].[FunctionName]"
```

## Environment Variables

The Lambda functions need these environment variables (set in Terraform):

### run-now Lambda
- `WEEKLY_DIGEST_FUNCTION_NAME`: Name of the weekly-digest Lambda

### weekly-digest Lambda
- `STORAGE_TYPE`: "s3" or "dynamodb"
- `S3_BUCKET`: S3 bucket name for processed emails
- `DYNAMODB_TABLE`: DynamoDB table for known senders
- `GMAIL_CLIENT_ID`: Gmail OAuth client ID
- `GMAIL_CLIENT_SECRET`: Gmail OAuth client secret
- `GMAIL_REFRESH_TOKEN`: Gmail OAuth refresh token
- `OPENAI_API_KEY`: OpenAI API key
- `HELICONE_API_KEY`: Helicone API key (optional)
- `RESEND_API_KEY`: Resend API key for sending emails
- `RECIPIENT_EMAIL`: Email address to send digests to

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌────────────────┐
│ API Gateway │────▶│  run-now    │────▶│ weekly-digest  │
└─────────────┘     │   Lambda    │     │    Lambda      │
                    └─────────────┘     └────────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │    Gmail     │
                                        │     API      │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │   OpenAI     │
                                        │     API      │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │   Resend     │
                                        │   (Email)    │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │  S3/DynamoDB │
                                        │  (Storage)   │
                                        └──────────────┘
```