#!/bin/bash

# This script sets AWS environment variables for Terraform
# Source this file before running terraform: source ./set-aws-env.sh

# Read AWS credentials from ~/.aws/credentials
AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id --profile default)
AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key --profile default)
AWS_REGION=$(aws configure get region --profile default)

# Export for Terraform
export AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
export AWS_REGION=${AWS_REGION:-eu-west-2}

echo "✅ AWS environment variables set:"
echo "   AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
echo "   AWS_REGION: $AWS_REGION"
echo ""
echo "Now you can run: terraform apply --auto-approve"