#!/bin/bash

# Deploy Lambda functions to AWS
# This script updates the Lambda function code without using Terraform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Deploying Lambda functions to AWS...${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    exit 1
fi

# Check if Lambda package exists
if [ ! -f "terraform/artifacts/lambda.zip" ]; then
    echo -e "${RED}❌ Lambda package not found. Run 'npm run build:aws' first${NC}"
    exit 1
fi

# Get the project name from environment or use default
PROJECT_NAME=${PROJECT_NAME:-"ai-digest"}

# Update run-now Lambda
echo -e "${YELLOW}📦 Updating run-now Lambda...${NC}"
aws lambda update-function-code \
    --function-name "${PROJECT_NAME}-run-now" \
    --zip-file fileb://terraform/artifacts/lambda.zip \
    --region ${AWS_REGION:-us-east-1} \
    --no-cli-pager

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ run-now Lambda updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to update run-now Lambda${NC}"
    exit 1
fi

# Update weekly-digest Lambda
echo -e "${YELLOW}📦 Updating weekly-digest Lambda...${NC}"
aws lambda update-function-code \
    --function-name "${PROJECT_NAME}-weekly-digest" \
    --zip-file fileb://terraform/artifacts/lambda.zip \
    --region ${AWS_REGION:-us-east-1} \
    --no-cli-pager

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ weekly-digest Lambda updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to update weekly-digest Lambda${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 All Lambda functions updated successfully!${NC}"
echo ""
echo -e "${YELLOW}Note: The functions may take a few seconds to update. Wait a moment before testing.${NC}"