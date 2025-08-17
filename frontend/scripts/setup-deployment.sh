#!/bin/bash

# Script to set up deployment configuration after Terraform apply

echo "Setting up AI Digest Frontend Deployment"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the frontend directory
if [ ! -f "package.json" ] || [ ! -d "app" ]; then
    echo "Error: Please run this script from the frontend directory"
    exit 1
fi

echo -e "${YELLOW}Step 1: Get Lambda Function URLs from Terraform${NC}"
echo "Run the following commands in the terraform/aws directory:"
echo ""
echo "  cd ../terraform/aws"
echo "  terraform output -json | jq -r '.run_now_function_url.value'"
echo "  terraform output -json | jq -r '.weekly_digest_function_url.value'"
echo ""

read -p "Enter the run-now function URL: " RUN_NOW_URL
read -p "Enter the weekly-digest function URL: " WEEKLY_URL

# Update .env.local with Lambda Function URLs
if [ -n "$RUN_NOW_URL" ] && [ -n "$WEEKLY_URL" ]; then
    echo -e "${GREEN}Updating .env.local with Lambda Function URLs...${NC}"
    
    # Check if .env.local exists
    if [ ! -f ".env.local" ]; then
        cp .env.local.example .env.local 2>/dev/null || echo "Creating .env.local..."
    fi
    
    # Update or add Lambda Function URLs
    if grep -q "LAMBDA_RUN_NOW_URL=" .env.local; then
        sed -i.bak "s|LAMBDA_RUN_NOW_URL=.*|LAMBDA_RUN_NOW_URL=$RUN_NOW_URL|" .env.local
    else
        echo "LAMBDA_RUN_NOW_URL=$RUN_NOW_URL" >> .env.local
    fi
    
    if grep -q "LAMBDA_WEEKLY_DIGEST_URL=" .env.local; then
        sed -i.bak "s|LAMBDA_WEEKLY_DIGEST_URL=.*|LAMBDA_WEEKLY_DIGEST_URL=$WEEKLY_URL|" .env.local
    else
        echo "LAMBDA_WEEKLY_DIGEST_URL=$WEEKLY_URL" >> .env.local
    fi
    
    echo -e "${GREEN}Lambda Function URLs updated in .env.local${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Vercel Deployment${NC}"
echo "1. Install Vercel CLI if not already installed:"
echo "   npm i -g vercel"
echo ""
echo "2. Link your project to Vercel:"
echo "   vercel link"
echo ""
echo "3. Set environment variables in Vercel:"
echo "   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "   vercel env add CLERK_SECRET_KEY"
echo "   vercel env add AWS_REGION"
echo "   vercel env add AWS_ACCESS_KEY_ID"
echo "   vercel env add AWS_SECRET_ACCESS_KEY"
echo "   vercel env add DYNAMODB_TABLE_NAME"
echo "   vercel env add LAMBDA_RUN_NOW_URL"
echo "   vercel env add LAMBDA_WEEKLY_DIGEST_URL"
echo ""
echo "4. Deploy to production:"
echo "   vercel --prod"
echo ""

echo -e "${YELLOW}Step 3: Update Terraform with your Vercel domain${NC}"
echo "Once deployed, update terraform/aws/terraform.tfvars with:"
echo "  allowed_origins = [\"https://your-app.vercel.app\", \"http://localhost:3000\"]"
echo ""
echo "Then run:"
echo "  cd ../terraform/aws"
echo "  terraform apply"
echo ""

echo -e "${GREEN}Setup complete!${NC}"
echo "Your frontend is ready for deployment to Vercel."
echo ""
echo "Next steps:"
echo "1. Get your Clerk keys from https://dashboard.clerk.com"
echo "2. Update .env.local with your actual credentials"
echo "3. Test locally with: npm run dev"
echo "4. Deploy to Vercel with: vercel --prod"