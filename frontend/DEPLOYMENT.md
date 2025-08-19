# AI Digest Frontend Deployment Guide

## Prerequisites

1. **Clerk Account**: Sign up at https://clerk.dev for authentication
2. **AWS Account**: Required for DynamoDB storage
3. **Vercel Account** (optional): For deployment

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Run the setup script:
```bash
./scripts/setup-env.sh
```

Or manually create `.env.local`:
```bash
cp .env.example .env.local
```

### 3. Required Environment Variables

#### Clerk Authentication
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

Get these from your Clerk dashboard at https://dashboard.clerk.dev

#### AWS Configuration
```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=ai-digest-known-ai-senders
```

#### IAM Permissions Required
Your AWS user needs the following DynamoDB permissions:
- `dynamodb:DescribeTable`
- `dynamodb:Scan`
- `dynamodb:PutItem`
- `dynamodb:BatchWriteItem`

Example IAM Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:Scan",
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/ai-digest-known-ai-senders"
    }
  ]
}
```

### 4. Create DynamoDB Table

Create a table named `ai-digest-known-ai-senders` with:
- Partition key: `senderEmail` (String)

AWS CLI command:
```bash
aws dynamodb create-table \
  --table-name ai-digest-known-ai-senders \
  --attribute-definitions AttributeName=senderEmail,AttributeType=S \
  --key-schema AttributeName=senderEmail,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 5. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Testing Your Setup

1. Go to http://localhost:3000/dashboard/diagnostics
2. Check all green checkmarks for:
   - Environment variables
   - DynamoDB connection
   - Table existence
   - API endpoints

## Vercel Deployment

### 1. Deploy to Vercel

```bash
vercel
```

### 2. Configure Environment Variables

In Vercel Dashboard (https://vercel.com/dashboard):
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add all variables from `.env.local`
4. Redeploy for changes to take effect

### 3. Important Vercel Settings

- Root Directory: `frontend` (set in vercel.json)
- Build Command: `npm run build`
- Output Directory: `.next`

## Troubleshooting

### Common Issues

#### 1. "AWS credentials not configured"
- Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Check environment variables in Vercel dashboard

#### 2. "DynamoDB table not found"
- Verify table name matches `DYNAMODB_TABLE_NAME`
- Check AWS region is correct
- Ensure table exists in the specified region

#### 3. "Access denied" errors
- Verify IAM permissions for your AWS user
- Check the IAM policy includes all required actions

#### 4. CORS errors
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly
- For local development: `http://localhost:3000`
- For production: Your Vercel URL

### Debug Mode

Visit `/dashboard/diagnostics` to see:
- Environment variable status
- AWS connection health
- DynamoDB table status
- API endpoint tests
- Detailed error messages

## Security Notes

- Never commit `.env.local` to version control
- Use environment-specific credentials
- Rotate AWS access keys regularly
- Limit IAM permissions to minimum required
- Use Clerk's security features (MFA, etc.)

## Support

For issues, check:
1. `/dashboard/diagnostics` page
2. Browser console for errors
3. Vercel function logs
4. AWS CloudWatch logs