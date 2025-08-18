# Vercel Environment Variables Setup

## Required Environment Variables

You need to add these environment variables in your Vercel project settings:

### 1. Go to Vercel Dashboard
1. Navigate to your project: https://vercel.com/dashboard
2. Select your `ai-digest` project
3. Go to **Settings** → **Environment Variables**

### 2. Add the Following Variables

Copy and paste each of these:

#### AWS Configuration (Required)
```
AWS_ACCESS_KEY_ID=[Your AWS Access Key - starts with AKIA]
AWS_SECRET_ACCESS_KEY=[Your AWS Secret Access Key]
AWS_REGION=us-east-1
```

#### AWS Resources (Required)
```
DYNAMODB_TABLE_NAME=ai-digest-known-ai-senders
S3_BUCKET_NAME=ai-digest-processed-emails-536697242054-us-east-1
```

#### Lambda Function URLs (Required)
```
LAMBDA_RUN_NOW_URL=https://hdjqmiho6lyzn6npbfv4qakws40gynjv.lambda-url.us-east-1.on.aws/
LAMBDA_WEEKLY_DIGEST_URL=https://bjnogkurk7ybyz43l6so4xhrmi0qeoos.lambda-url.us-east-1.on.aws/
```

#### Lambda Function Names (Optional - for SDK invocation)
```
LAMBDA_DIGEST_FUNCTION_NAME=ai-digest-run-now
LAMBDA_WEEKLY_FUNCTION_NAME=ai-digest-weekly-digest
```

#### API Gateway (Optional - alternative to Lambda URLs)
```
API_GATEWAY_URL=https://f9dxsudfia.execute-api.us-east-1.amazonaws.com/prod
API_KEY_ID=4whkf2bdv6
```

#### Clerk Authentication (Required)
You need to get these from your Clerk dashboard:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=[Your Clerk Publishable Key - starts with pk_]
CLERK_SECRET_KEY=[Your Clerk Secret Key - starts with sk_]
```

#### Clerk URLs (Required)
```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

#### App Configuration
```
NEXT_PUBLIC_APP_URL=https://ai-digest-vert.vercel.app
```

### 3. Select Environment Scope
For each variable, select which environments it should be available in:
- ✅ Production
- ✅ Preview  
- ✅ Development

### 4. Save and Redeploy
1. Click **Save** after adding all variables
2. Go to **Deployments** tab
3. Click the three dots (...) on the latest deployment
4. Select **Redeploy**
5. Check **Use existing Build Cache** (uncheck it)
6. Click **Redeploy**

## Verifying the Setup

After redeployment, test the API:

```bash
# Test senders API (while logged in)
curl https://ai-digest-vert.vercel.app/api/senders

# You should see either:
# - An empty array: []
# - Or a list of senders if any exist
```

## Troubleshooting

### "Failed to fetch senders" Error
- Check that AWS credentials are correctly set in Vercel
- Verify AWS_REGION is set to `us-east-1`
- Ensure DYNAMODB_TABLE_NAME is set to `ai-digest-known-ai-senders`

### "Unauthorized" Error
- Make sure you're logged in via Clerk
- Check that Clerk environment variables are set

### CORS Errors
- The Lambda Function URLs are already configured for your domain
- If you change your Vercel domain, run: `./scripts/update-cors.sh`

## AWS IAM Permissions Required

The AWS access key needs these permissions:
- DynamoDB: Read/Write access to `ai-digest-known-ai-senders` table
- Lambda: Invoke permissions for the digest functions
- S3: Read/Write access to the processed emails bucket

## Security Notes

⚠️ **Important**: These are sensitive credentials. Make sure to:
1. Never commit them to your repository
2. Rotate them regularly
3. Use IAM roles with minimal required permissions
4. Consider using Vercel's AWS integration for more secure credential management