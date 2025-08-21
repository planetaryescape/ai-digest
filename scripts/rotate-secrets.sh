#!/bin/bash

# Script to rotate secrets in AWS Secrets Manager
# This allows updating individual secrets without affecting others

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 AWS Secrets Manager Rotation Script${NC}"
echo "================================================"

# Configuration
AWS_REGION=${AWS_REGION:-"us-east-1"}
PROJECT_NAME=${PROJECT_NAME:-"ai-digest"}
SECRET_NAME="${PROJECT_NAME}-api-keys"

# Function to display menu
show_menu() {
    echo -e "${BLUE}Which secret would you like to rotate?${NC}"
    echo "1. Gmail OAuth Credentials"
    echo "2. OpenAI API Key"
    echo "3. Resend API Key"
    echo "4. Helicone API Key"
    echo "5. All Secrets"
    echo "0. Exit"
    echo ""
}

# Function to get current secret
get_current_secret() {
    aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text
}

# Function to update secret
update_secret() {
    local secret_json=$1
    aws secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --secret-string "$secret_json" \
        --region "$AWS_REGION"
}

# Function to rotate Gmail credentials
rotate_gmail() {
    echo -e "${YELLOW}Rotating Gmail OAuth Credentials...${NC}"
    read -p "Enter new GMAIL_CLIENT_ID: " new_client_id
    read -p "Enter new GMAIL_CLIENT_SECRET: " new_client_secret
    read -p "Enter new GMAIL_REFRESH_TOKEN: " new_refresh_token
    
    # Get current secret
    current_secret=$(get_current_secret)
    
    # Update with new Gmail credentials
    updated_secret=$(echo "$current_secret" | jq \
        --arg id "$new_client_id" \
        --arg secret "$new_client_secret" \
        --arg token "$new_refresh_token" \
        '.gmail_client_id = $id | .gmail_client_secret = $secret | .gmail_refresh_token = $token')
    
    update_secret "$updated_secret"
    echo -e "${GREEN}✅ Gmail credentials rotated successfully!${NC}"
}

# Function to rotate OpenAI key
rotate_openai() {
    echo -e "${YELLOW}Rotating OpenAI API Key...${NC}"
    read -s -p "Enter new OPENAI_API_KEY: " new_key
    echo ""
    
    # Get current secret
    current_secret=$(get_current_secret)
    
    # Update with new OpenAI key
    updated_secret=$(echo "$current_secret" | jq --arg key "$new_key" '.openai_api_key = $key')
    
    update_secret "$updated_secret"
    echo -e "${GREEN}✅ OpenAI API key rotated successfully!${NC}"
}

# Function to rotate Resend key
rotate_resend() {
    echo -e "${YELLOW}Rotating Resend API Key...${NC}"
    read -s -p "Enter new RESEND_API_KEY: " new_key
    echo ""
    
    # Get current secret
    current_secret=$(get_current_secret)
    
    # Update with new Resend key
    updated_secret=$(echo "$current_secret" | jq --arg key "$new_key" '.resend_api_key = $key')
    
    update_secret "$updated_secret"
    echo -e "${GREEN}✅ Resend API key rotated successfully!${NC}"
}

# Function to rotate Helicone key
rotate_helicone() {
    echo -e "${YELLOW}Rotating Helicone API Key...${NC}"
    read -s -p "Enter new HELICONE_API_KEY: " new_key
    echo ""
    
    # Get current secret
    current_secret=$(get_current_secret)
    
    # Update with new Helicone key
    updated_secret=$(echo "$current_secret" | jq --arg key "$new_key" '.helicone_api_key = $key')
    
    update_secret "$updated_secret"
    echo -e "${GREEN}✅ Helicone API key rotated successfully!${NC}"
}

# Function to rotate all secrets
rotate_all() {
    echo -e "${YELLOW}Rotating all secrets...${NC}"
    echo "Please have all new credentials ready."
    echo ""
    
    rotate_gmail
    rotate_openai
    rotate_resend
    rotate_helicone
    
    echo -e "${GREEN}✅ All secrets rotated successfully!${NC}"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is required but not installed${NC}"
    echo "Install it using: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS CLI not configured or no valid credentials${NC}"
    exit 1
fi

# Check if secret exists
if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Secret '$SECRET_NAME' not found${NC}"
    echo "Run init-secrets.sh first to create the secret"
    exit 1
fi

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice: " choice
    
    case $choice in
        1)
            rotate_gmail
            ;;
        2)
            rotate_openai
            ;;
        3)
            rotate_resend
            ;;
        4)
            rotate_helicone
            ;;
        5)
            rotate_all
            ;;
        0)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please try again.${NC}"
            ;;
    esac
    
    echo ""
    echo -e "${YELLOW}Note: Lambda functions will pick up new secrets on next cold start${NC}"
    echo "Press Enter to continue..."
    read
done