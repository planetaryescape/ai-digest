#!/bin/bash

# Script to initialize AWS Secrets Manager with API keys
# This script reads from .env.aws file and creates/updates the secret in AWS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 AWS Secrets Manager Initialization Script${NC}"
echo "================================================"

# Check if .env.aws exists
if [ ! -f .env.aws ]; then
    echo -e "${RED}❌ Error: .env.aws file not found${NC}"
    echo "Please create .env.aws with your API keys first"
    exit 1
fi

# Load environment variables from .env.aws
source .env.aws

# Check required variables
required_vars=(
    "GMAIL_CLIENT_ID"
    "GMAIL_CLIENT_SECRET"
    "GMAIL_REFRESH_TOKEN"
    "OPENAI_API_KEY"
    "RESEND_API_KEY"
    "RECIPIENT_EMAIL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Error: Missing required environment variables:${NC}"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

# Get AWS account details
AWS_REGION=${AWS_REGION:-"us-east-1"}
PROJECT_NAME=${PROJECT_NAME:-"ai-digest"}
SECRET_NAME="${PROJECT_NAME}-api-keys"

echo -e "${YELLOW}📍 AWS Region: ${AWS_REGION}${NC}"
echo -e "${YELLOW}📦 Project: ${PROJECT_NAME}${NC}"
echo -e "${YELLOW}🔑 Secret Name: ${SECRET_NAME}${NC}"
echo ""

# Create JSON payload for the secret
SECRET_JSON=$(cat <<EOF
{
  "gmail_client_id": "${GMAIL_CLIENT_ID}",
  "gmail_client_secret": "${GMAIL_CLIENT_SECRET}",
  "gmail_refresh_token": "${GMAIL_REFRESH_TOKEN}",
  "openai_api_key": "${OPENAI_API_KEY}",
  "helicone_api_key": "${HELICONE_API_KEY:-}",
  "resend_api_key": "${RESEND_API_KEY}",
  "resend_from": "${RECIPIENT_EMAIL}"
}
EOF
)

# Check if secret already exists
echo "Checking if secret already exists..."
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Secret already exists. Updating...${NC}"
    
    # Update existing secret
    aws secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✅ Secret updated successfully!${NC}"
else
    echo "Secret does not exist. Creating new secret..."
    
    # Create new secret
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "API keys and credentials for AI Digest application" \
        --secret-string "$SECRET_JSON" \
        --region "$AWS_REGION" \
        --tags "Key=Project,Value=${PROJECT_NAME}" "Key=Environment,Value=production" "Key=ManagedBy,Value=Terraform"
    
    echo -e "${GREEN}✅ Secret created successfully!${NC}"
fi

# Get secret ARN
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" --query 'ARN' --output text)

echo ""
echo -e "${GREEN}🎉 Success! Your secrets are now stored in AWS Secrets Manager${NC}"
echo "================================================"
echo -e "${YELLOW}Secret ARN:${NC} $SECRET_ARN"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Deploy the Lambda functions: npm run deploy:aws"
echo "2. Test the functions to ensure they can access the secrets"
echo ""
echo -e "${GREEN}Security Notes:${NC}"
echo "• Secrets are encrypted at rest using AWS KMS"
echo "• Lambda functions will fetch secrets on cold start"
echo "• No sensitive data in environment variables"
echo "• Enable secret rotation for enhanced security"