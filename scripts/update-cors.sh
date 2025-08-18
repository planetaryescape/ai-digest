#!/bin/bash

# Script to update CORS configuration for Lambda Function URLs

echo "Updating CORS configuration for AI Digest Lambda functions..."
echo ""

# Define the allowed origins
ALLOWED_ORIGINS='["http://localhost:3000","https://ai-digest-vert.vercel.app"]'

# Update Lambda Function URLs
echo "Updating run-now function URL CORS..."
aws lambda update-function-url-config \
  --function-name ai-digest-run-now \
  --cors '{
    "AllowCredentials": true,
    "AllowOrigins": '"$ALLOWED_ORIGINS"',
    "AllowMethods": ["*"],
    "AllowHeaders": ["*"],
    "ExposeHeaders": ["*"],
    "MaxAge": 86400
  }' \
  --region us-east-1

echo "Updating weekly-digest function URL CORS..."
aws lambda update-function-url-config \
  --function-name ai-digest-weekly-digest \
  --cors '{
    "AllowCredentials": true,
    "AllowOrigins": '"$ALLOWED_ORIGINS"',
    "AllowMethods": ["*"],
    "AllowHeaders": ["*"],
    "ExposeHeaders": ["*"],
    "MaxAge": 86400
  }' \
  --region us-east-1

echo ""
echo "✅ CORS configuration updated!"
echo ""
echo "Allowed origins:"
echo "  - http://localhost:3000"
echo "  - https://ai-digest-vert.vercel.app"
echo ""
echo "To add more origins, update the ALLOWED_ORIGINS variable in this script."