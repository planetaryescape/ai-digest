#!/bin/bash

echo "🚀 AI Digest Frontend Environment Setup"
echo "======================================="
echo ""

ENV_FILE=".env.local"
ENV_EXAMPLE=".env.example"

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  .env.local already exists. Backing up to .env.local.backup"
    cp "$ENV_FILE" "$ENV_FILE.backup"
fi

cp "$ENV_EXAMPLE" "$ENV_FILE"
echo "✅ Created .env.local from .env.example"
echo ""

echo "Please configure the following environment variables in .env.local:"
echo ""

echo "1. Clerk Authentication (https://clerk.dev):"
echo "   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "   - CLERK_SECRET_KEY"
echo ""

echo "2. AWS Credentials (for DynamoDB access):"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - AWS_REGION (default: us-east-1)"
echo ""

echo "3. DynamoDB Configuration:"
echo "   - DYNAMODB_TABLE_NAME (default: ai-digest-known-ai-senders)"
echo ""

echo "4. Lambda Functions (optional):"
echo "   - LAMBDA_DIGEST_FUNCTION_NAME"
echo "   - LAMBDA_WEEKLY_FUNCTION_NAME"
echo ""

read -p "Would you like to open .env.local in your editor now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v code &> /dev/null; then
        code "$ENV_FILE"
    elif command -v nano &> /dev/null; then
        nano "$ENV_FILE"
    elif command -v vim &> /dev/null; then
        vim "$ENV_FILE"
    else
        echo "Please open $ENV_FILE manually in your preferred editor"
    fi
fi

echo ""
echo "🔍 After configuration, you can test your setup by:"
echo "   1. Run: npm run dev"
echo "   2. Visit: http://localhost:3000/dashboard/diagnostics"
echo ""
echo "✅ Setup complete!"