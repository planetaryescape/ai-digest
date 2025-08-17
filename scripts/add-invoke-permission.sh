#!/bin/bash

# Add Lambda invoke permission to the existing IAM role
# This allows run-now Lambda to invoke weekly-digest Lambda

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_NAME=${PROJECT_NAME:-"ai-digest"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

echo -e "${YELLOW}🔧 Adding Lambda invoke permissions...${NC}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Failed to get AWS account ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ AWS Account ID: $ACCOUNT_ID${NC}"

# Create the policy document
cat > /tmp/lambda-invoke-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction"
            ],
            "Resource": [
                "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${PROJECT_NAME}-weekly-digest"
            ]
        }
    ]
}
EOF

echo -e "${YELLOW}📝 Creating IAM policy...${NC}"

# Create the policy
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${PROJECT_NAME}-lambda-invoke"

# Check if policy already exists
if aws iam get-policy --policy-arn "$POLICY_ARN" 2>/dev/null; then
    echo -e "${YELLOW}Policy already exists, updating...${NC}"
    
    # Create a new version of the policy
    aws iam create-policy-version \
        --policy-arn "$POLICY_ARN" \
        --policy-document file:///tmp/lambda-invoke-policy.json \
        --set-as-default \
        --no-cli-pager
else
    # Create new policy
    aws iam create-policy \
        --policy-name "${PROJECT_NAME}-lambda-invoke" \
        --policy-document file:///tmp/lambda-invoke-policy.json \
        --no-cli-pager
fi

echo -e "${GREEN}✓ IAM policy created/updated${NC}"

# Attach the policy to the Lambda role
echo -e "${YELLOW}🔗 Attaching policy to Lambda role...${NC}"

aws iam attach-role-policy \
    --role-name "${PROJECT_NAME}-lambda-role" \
    --policy-arn "$POLICY_ARN" \
    --no-cli-pager

echo -e "${GREEN}✅ Successfully added Lambda invoke permissions!${NC}"
echo ""
echo -e "${YELLOW}The run-now Lambda can now invoke the weekly-digest Lambda.${NC}"

# Clean up
rm -f /tmp/lambda-invoke-policy.json