#!/bin/bash

# Add resource-based permission to allow run-now to invoke weekly-digest
# This doesn't require IAM permissions, only Lambda permissions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_NAME=${PROJECT_NAME:-"ai-digest"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

echo -e "${YELLOW}🔧 Adding Lambda resource-based permission...${NC}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Failed to get AWS account ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ AWS Account ID: $ACCOUNT_ID${NC}"
echo -e "${GREEN}✓ Region: $AWS_REGION${NC}"
echo -e "${GREEN}✓ Project: $PROJECT_NAME${NC}"

# Remove existing permission if it exists (ignore errors)
echo -e "${YELLOW}Removing any existing permission...${NC}"
aws lambda remove-permission \
    --function-name "${PROJECT_NAME}-weekly-digest" \
    --statement-id "AllowInvokeFromRunNow" \
    --region "$AWS_REGION" \
    --no-cli-pager 2>/dev/null || true

# Add permission for run-now Lambda to invoke weekly-digest
echo -e "${YELLOW}📝 Adding permission to weekly-digest Lambda...${NC}"

# Get the run-now Lambda's execution role ARN
RUN_NOW_ROLE=$(aws lambda get-function \
    --function-name "${PROJECT_NAME}-run-now" \
    --query 'Configuration.Role' \
    --output text \
    --region "$AWS_REGION")

if [ -z "$RUN_NOW_ROLE" ]; then
    echo -e "${RED}❌ Failed to get run-now Lambda role${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Run-now Lambda role: $RUN_NOW_ROLE${NC}"

# Add permission using the Lambda service principal approach
# This allows ANY Lambda function with the specified role to invoke weekly-digest
aws lambda add-permission \
    --function-name "${PROJECT_NAME}-weekly-digest" \
    --statement-id "AllowInvokeFromRunNow" \
    --action "lambda:InvokeFunction" \
    --principal "$RUN_NOW_ROLE" \
    --region "$AWS_REGION" \
    --no-cli-pager

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully added resource-based permission!${NC}"
    
    # Verify the permission was added
    echo -e "${YELLOW}Verifying permission...${NC}"
    POLICY=$(aws lambda get-policy \
        --function-name "${PROJECT_NAME}-weekly-digest" \
        --query 'Policy' \
        --output text \
        --region "$AWS_REGION" 2>/dev/null)
    
    if [ ! -z "$POLICY" ]; then
        echo -e "${GREEN}✓ Permission policy confirmed${NC}"
        echo ""
        echo -e "${YELLOW}Policy details:${NC}"
        echo "$POLICY" | python3 -m json.tool | grep -A 5 "AllowInvokeFromRunNow" || echo "$POLICY"
    fi
else
    echo -e "${YELLOW}⚠️  Direct role-based permission failed, trying with Lambda service principal...${NC}"
    
    # Alternative approach: Use lambda.amazonaws.com as principal with condition
    aws lambda add-permission \
        --function-name "${PROJECT_NAME}-weekly-digest" \
        --statement-id "AllowInvokeFromRunNowService" \
        --action "lambda:InvokeFunction" \
        --principal "lambda.amazonaws.com" \
        --source-arn "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${PROJECT_NAME}-run-now" \
        --region "$AWS_REGION" \
        --no-cli-pager
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Added permission with Lambda service principal!${NC}"
    else
        echo -e "${RED}❌ Failed to add resource-based permission${NC}"
        echo -e "${YELLOW}You may need to ask your AWS administrator to add the following IAM policy to the ${PROJECT_NAME}-lambda-role:${NC}"
        echo ""
        cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "lambda:InvokeFunction",
            "Resource": "arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${PROJECT_NAME}-weekly-digest"
        }
    ]
}
EOF
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}🎉 Permission added! The run-now Lambda can now invoke weekly-digest.${NC}"
echo ""
echo -e "${YELLOW}Test it now:${NC}"
echo "aws lambda invoke \\"
echo "  --function-name ${PROJECT_NAME}-run-now \\"
echo "  --payload '{}' \\"
echo "  response.json \\"
echo "  --region $AWS_REGION"
echo ""
echo "cat response.json"