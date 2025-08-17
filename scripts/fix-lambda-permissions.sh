#!/bin/bash

# Add Lambda invoke permission using inline policy
# This is simpler and doesn't require creating new IAM policies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_NAME=${PROJECT_NAME:-"ai-digest"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

echo -e "${YELLOW}🔧 Fixing Lambda permissions...${NC}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Failed to get AWS account ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ AWS Account ID: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✓ Region: $AWS_REGION${NC}"
echo -e "${GREEN}✓ Project: $PROJECT_NAME${NC}"

# Create the inline policy document
cat > /tmp/lambda-invoke-inline-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction",
                "lambda:GetFunction"
            ],
            "Resource": [
                "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${PROJECT_NAME}-weekly-digest"
            ]
        }
    ]
}
EOF

echo -e "${YELLOW}📝 Adding inline policy to Lambda role...${NC}"

# Add inline policy to the role
aws iam put-role-policy \
    --role-name "${PROJECT_NAME}-lambda-role" \
    --policy-name "InvokeWeeklyDigest" \
    --policy-document file:///tmp/lambda-invoke-inline-policy.json \
    --no-cli-pager

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully added Lambda invoke permissions!${NC}"
else
    echo -e "${RED}❌ Failed to add inline policy${NC}"
    echo -e "${YELLOW}Trying alternative approach...${NC}"
    
    # Alternative: Add permission at the Lambda resource level
    echo -e "${YELLOW}Adding resource-based policy to weekly-digest Lambda...${NC}"
    
    aws lambda add-permission \
        --function-name "${PROJECT_NAME}-weekly-digest" \
        --statement-id "AllowInvokeFromRunNow" \
        --action "lambda:InvokeFunction" \
        --principal "arn:aws:iam::${ACCOUNT_ID}:role/${PROJECT_NAME}-lambda-role" \
        --no-cli-pager 2>/dev/null || true
    
    echo -e "${GREEN}✓ Added resource-based permission${NC}"
fi

# Clean up
rm -f /tmp/lambda-invoke-inline-policy.json

echo ""
echo -e "${GREEN}🎉 Permissions fixed! The run-now Lambda can now invoke weekly-digest.${NC}"
echo ""
echo -e "${YELLOW}Test it with:${NC}"
echo "aws lambda invoke \\"
echo "  --function-name ${PROJECT_NAME}-run-now \\"
echo "  --payload '{}' \\"
echo "  response.json"