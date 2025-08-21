# CORS Configuration Guide

## Overview

The AI Digest system supports CORS (Cross-Origin Resource Sharing) to allow the Vercel-hosted frontend to communicate with AWS Lambda functions.

## Lambda Function URLs vs API Gateway

### Lambda Function URLs (Recommended)
- Direct HTTP endpoints for Lambda functions
- Built-in CORS support
- No API Gateway overhead
- Simpler authentication model
- Lower latency

### API Gateway + Lambda
- Traditional REST API approach
- More complex but more features
- API key authentication
- Request/response transformation
- Rate limiting and throttling

## CORS Configuration

### Important Limitation

⚠️ **Lambda Function URLs do not support wildcard subdomains** like `https://*.vercel.app`. 

You have three options:

1. **Development Mode** - Allow all origins:
   ```hcl
   allowed_origins = ["*"]
   ```

2. **Production Mode** - Specify exact domains:
   ```hcl
   allowed_origins = [
     "http://localhost:3000",
     "https://ai-digest.vercel.app",
     "https://ai-digest-git-main.vercel.app"
   ]
   ```

3. **Hybrid Approach** - Use API Gateway for more control

## Setup Instructions

### Step 1: Initial Deployment (Development)

1. Use wildcard for initial setup in `terraform.tfvars`:
   ```hcl
   allowed_origins = ["*"]
   ```

2. Deploy with Terraform:
   ```bash
   cd terraform/aws
   terraform apply
   ```

3. Get the Lambda Function URLs:
   ```bash
   terraform output run_now_function_url
   terraform output weekly_digest_function_url
   ```

### Step 2: Deploy Frontend to Vercel

1. Deploy your frontend:
   ```bash
   cd frontend
   vercel --prod
   ```

2. Note your production domain (e.g., `ai-digest.vercel.app`)

### Step 3: Update CORS for Production

1. Update `terraform.tfvars` with your actual domains:
   ```hcl
   allowed_origins = [
     "http://localhost:3000",
     "https://ai-digest.vercel.app",
     "https://ai-digest-preview.vercel.app"
   ]
   ```

2. Re-apply Terraform:
   ```bash
   terraform apply
   ```

## Frontend Configuration

### Using Lambda Function URLs

In your frontend `.env.local`:
```env
# Direct Lambda Function URLs
LAMBDA_RUN_NOW_URL=https://xxx.lambda-url.us-east-1.on.aws/
LAMBDA_WEEKLY_DIGEST_URL=https://yyy.lambda-url.us-east-1.on.aws/
```

### Using AWS SDK (Alternative)

If you prefer using the AWS SDK:
```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
LAMBDA_DIGEST_FUNCTION_NAME=ai-digest-run-now
LAMBDA_WEEKLY_FUNCTION_NAME=ai-digest-weekly-digest
```

## Vercel Preview Deployments

Vercel creates preview deployments with unique URLs for each PR/branch. To support these:

### Option 1: Use Wildcard (Development Only)
Keep `allowed_origins = ["*"]` during development.

### Option 2: Add Preview Domains
Add known preview domains to your allowed origins:
```hcl
allowed_origins = [
  "http://localhost:3000",
  "https://ai-digest.vercel.app",
  "https://ai-digest-preview.vercel.app",
  "https://ai-digest-git-main.vercel.app",
  "https://ai-digest-git-develop.vercel.app"
]
```

### Option 3: Environment-Specific Lambda Functions
Deploy separate Lambda functions for development/staging with wildcard CORS.

## Troubleshooting

### CORS Errors in Browser Console

1. **Check allowed origins** in Terraform:
   ```bash
   terraform show | grep allowed_origins
   ```

2. **Verify Lambda Function URL CORS**:
   ```bash
   aws lambda get-function-url-config --function-name ai-digest-run-now
   ```

3. **Test with curl**:
   ```bash
   curl -X OPTIONS https://your-function-url.lambda-url.region.on.aws/ \
     -H "Origin: https://your-app.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```

### Common Issues

1. **"CORS policy: No 'Access-Control-Allow-Origin' header"**
   - Solution: Add your domain to `allowed_origins` in Terraform

2. **"The request client is not a secure context"**
   - Solution: Use HTTPS for production domains

3. **"Preflight response is not successful"**
   - Solution: Ensure OPTIONS method is handled (automatic with Lambda Function URLs)

## Security Best Practices

1. **Never use wildcard `*` in production**
2. **Use HTTPS everywhere**
3. **Rotate credentials regularly**
4. **Monitor access logs**
5. **Implement authentication**

## Migration Guide

### From Wildcard to Specific Domains

1. List all domains that need access
2. Update Terraform configuration
3. Apply changes
4. Test each domain

## Additional Resources

- [AWS Lambda Function URLs Documentation](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
- [Vercel Deployment Documentation](https://vercel.com/docs/deployments/overview)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)