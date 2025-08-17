#!/bin/bash

# Export AWS credentials from AWS CLI config
export AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id)
export AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key)
export AWS_REGION=${AWS_REGION:-us-east-1}

# Verify credentials work
echo "Testing AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
    echo "✅ AWS credentials are valid"
    echo "   Region: $AWS_REGION"
    echo "   Account: $(aws sts get-caller-identity --query Account --output text)"
else
    echo "❌ AWS credentials are invalid"
    exit 1
fi

# Run terraform apply
echo ""
echo "Running terraform apply..."
/opt/homebrew/bin/terraform apply --auto-approve