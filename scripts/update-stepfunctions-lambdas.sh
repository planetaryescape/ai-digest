#!/bin/bash

# Update Step Functions Lambda handlers with new code
# This script updates the Lambda function code without running Terraform

set -e

echo "🚀 Updating Step Functions Lambda handlers..."

# Set the AWS region
export AWS_REGION=us-east-1

# Define all Step Functions Lambda function names
LAMBDA_FUNCTIONS=(
  "ai-digest-sf-email-fetcher"
  "ai-digest-sf-classifier"
  "ai-digest-sf-content-extractor"
  "ai-digest-sf-research"
  "ai-digest-sf-analysis"
  "ai-digest-sf-critic"
  "ai-digest-sf-digest-sender"
  "ai-digest-sf-error-handler"
)

# Path to the deployment package
PACKAGE_PATH="terraform/artifacts/lambda-stepfunctions.zip"

# Check if package exists
if [ ! -f "$PACKAGE_PATH" ]; then
  echo "❌ Deployment package not found at $PACKAGE_PATH"
  echo "Please run 'bun run build:stepfunctions' first"
  exit 1
fi

# Update each Lambda function
for FUNCTION_NAME in "${LAMBDA_FUNCTIONS[@]}"; do
  echo "📦 Updating $FUNCTION_NAME..."
  
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$PACKAGE_PATH" \
    --no-cli-pager \
    --output text \
    --query 'LastUpdateStatus' || {
      echo "⚠️  Failed to update $FUNCTION_NAME (it might not exist yet)"
    }
done

echo "✅ Step Functions Lambda handlers updated successfully!"
echo ""
echo "You can now test the Step Functions pipeline with:"
echo "  aws stepfunctions start-execution \\"
echo "    --state-machine-arn <your-state-machine-arn> \\"
echo "    --input '{\"mode\": \"weekly\"}'"