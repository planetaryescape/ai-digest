# AWS Lambda Configuration Fixes

## Issues Fixed

### 1. Environment Variable Mismatch
**Problem**: The run-now Lambda was looking for `WEEKLY_DIGEST_ARN` but Terraform was providing `WEEKLY_DIGEST_FUNCTION_NAME`.

**Fix**: Updated `run-now.ts` to use `WEEKLY_DIGEST_FUNCTION_NAME` instead:
```typescript
const weeklyDigestFunctionName = process.env.WEEKLY_DIGEST_FUNCTION_NAME;
```

### 2. Missing Lambda Invoke Permissions
**Problem**: The run-now Lambda didn't have permission to invoke the weekly-digest Lambda.

**Fix**: Added IAM policy in Terraform to grant invoke permissions:
```hcl
resource "aws_iam_policy" "lambda_invoke" {
  name = "${var.project_name}-lambda-invoke"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["lambda:InvokeFunction"]
        Resource = ["arn:aws:lambda:...:function:${var.project_name}-weekly-digest"]
      }
    ]
  })
}
```

## How the AWS Implementation Works

### Architecture
```
API Gateway -> run-now Lambda -> weekly-digest Lambda
                                        |
                                        v
                              - Fetch emails from Gmail
                              - Process with OpenAI
                              - Send digest via Resend
                              - Store in S3/DynamoDB
```

### Environment Variables
The Terraform configuration properly sets all required environment variables:
- Gmail OAuth credentials
- OpenAI API keys
- Resend API key
- Storage configuration (S3 bucket, DynamoDB table)
- Processing parameters

### Modes of Operation

1. **Scheduled Mode**: EventBridge triggers weekly-digest directly every Sunday at 9 AM UTC
2. **Manual Mode (Weekly)**: API Gateway -> run-now -> weekly-digest (last 7 days)
3. **Manual Mode (Cleanup)**: API Gateway -> run-now -> weekly-digest with cleanup=true (ALL emails)

## Deployment Steps

1. **Set AWS Credentials**:
```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

2. **Build Lambda Functions**:
```bash
npm run build:aws
```

3. **Deploy with Terraform**:
```bash
cd terraform/aws
terraform init
terraform plan
terraform apply
```

4. **Test Manual Trigger**:
```bash
# Get API Gateway URL and API Key from Terraform outputs
terraform output api_gateway_url
terraform output api_key_id

# Get the actual API key value
aws apigateway get-api-key --api-key <api_key_id> --include-value

# Test weekly mode
curl -X POST <api_gateway_url>/run \
  -H "x-api-key: <api_key_value>"

# Test cleanup mode
curl -X POST <api_gateway_url>/run?cleanup=true \
  -H "x-api-key: <api_key_value>"
```

## Key Differences from Azure Implementation

1. **Lambda Invocation**: AWS uses direct Lambda-to-Lambda invocation via SDK
2. **Storage**: Can use either S3 or DynamoDB (configurable via STORAGE_TYPE)
3. **API Gateway**: Requires API key for security
4. **Permissions**: Uses IAM roles and policies instead of managed identities

The AWS implementation is now fully functional and ready for deployment!