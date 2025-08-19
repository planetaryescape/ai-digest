#!/bin/bash

# Import existing AWS resources into Terraform state

# Check if we have the .env file
if [ ! -f "../../.env" ]; then
    echo "Error: .env file not found in project root"
    echo "Please copy .env.example to .env and fill in your values"
    exit 1
fi

# Source the environment variables
set -a
source ../../.env
set +a

echo "Importing existing AWS resources into Terraform state..."

# Use terraform with proper variable file handling
TERRAFORM_CMD="/opt/homebrew/bin/terraform"

# Import S3 buckets
echo "Importing S3 bucket for lambda deployments..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_s3_bucket.lambda_deployments ai-digest-lambda-deployments-536697242054-us-east-1 || true

echo "Importing S3 bucket for processed emails..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_s3_bucket.processed_emails ai-digest-processed-emails-536697242054-us-east-1 || true

# Import DynamoDB tables
echo "Importing DynamoDB table for known AI senders..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_dynamodb_table.known_ai_senders ai-digest-known-ai-senders || true

echo "Importing DynamoDB table for known non-AI senders..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_dynamodb_table.known_non_ai_senders ai-digest-known-non-ai-senders || true

# Import IAM role
echo "Importing IAM role..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_iam_role.lambda_role ai-digest-lambda-role || true

# Import IAM policy
echo "Importing IAM policy..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_iam_policy.lambda_invoke arn:aws:iam::536697242054:policy/ai-digest-lambda-invoke || true

# Import CloudWatch log groups
echo "Importing CloudWatch log groups..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_cloudwatch_log_group.weekly_digest /aws/lambda/ai-digest-weekly-digest || true

$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_cloudwatch_log_group.run_now /aws/lambda/ai-digest-run-now || true

# Import Lambda functions (if they exist)
echo "Importing Lambda functions..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_lambda_function.weekly_digest ai-digest-weekly-digest || true

$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_lambda_function.run_now ai-digest-run-now || true

# Import EventBridge rule (if it exists)
echo "Importing EventBridge rule..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_cloudwatch_event_rule.weekly_schedule ai-digest-weekly-schedule || true

# Import Lambda Function URLs
echo "Importing Lambda Function URLs..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_lambda_function_url.run_now ai-digest-run-now || true

$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_lambda_function_url.weekly_digest ai-digest-weekly-digest || true

# Import Lambda Permissions
echo "Importing Lambda Permissions..."
$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_lambda_permission.allow_eventbridge ai-digest-weekly-digest/AllowExecutionFromEventBridge || true

$TERRAFORM_CMD import \
    -var="GMAIL_CLIENT_ID=$GMAIL_CLIENT_ID" \
    -var="GMAIL_CLIENT_SECRET=$GMAIL_CLIENT_SECRET" \
    -var="GMAIL_REFRESH_TOKEN=$GMAIL_REFRESH_TOKEN" \
    -var="OPENAI_API_KEY=$OPENAI_API_KEY" \
    -var="HELICONE_API_KEY=${HELICONE_API_KEY:-}" \
    -var="RESEND_API_KEY=$RESEND_API_KEY" \
    -var="RECIPIENT_EMAIL=$RECIPIENT_EMAIL" \
    aws_lambda_permission.api_gateway_run ai-digest-run-now/AllowAPIGatewayInvoke || true

echo "Import complete! Now run 'terraform plan' to see what changes are needed."