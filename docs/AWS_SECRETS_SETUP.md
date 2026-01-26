# AWS Secrets Manager Setup Guide

## Overview
This guide explains how to set up and use AWS Secrets Manager for secure API key storage in the AI Digest application.

## Migration from Environment Variables

The application now supports loading API keys from AWS Secrets Manager instead of environment variables, providing better security and easier key rotation.

## Setup Instructions

### 1. Deploy the Secrets Infrastructure

The Terraform configuration will automatically create the secrets in AWS Secrets Manager:

```bash
cd terraform/aws
terraform apply
```

This will:
- Create a secret named `ai-digest-api-keys` in AWS Secrets Manager
- Store all API keys securely
- Grant Lambda functions permission to read the secret

### 2. Enable Secrets Manager in Lambda Functions

The Lambda functions automatically attempt to load secrets from AWS Secrets Manager on cold start. The `SECRET_ARN` environment variable is automatically configured by Terraform.

### 3. Manual Secret Creation (Optional)

If you need to create the secret manually:

```bash
aws secretsmanager create-secret \
  --name ai-digest-api-keys \
  --description "API keys for AI Digest" \
  --secret-string '{
    "gmail_client_id": "your-gmail-client-id",
    "gmail_client_secret": "your-gmail-client-secret", 
    "gmail_refresh_token": "your-gmail-refresh-token",
    "openai_api_key": "your-openai-api-key",
    "helicone_api_key": "your-helicone-api-key",
    "resend_api_key": "your-resend-api-key",
    "resend_from": "your-email@example.com",
    "firecrawl_api_key": "your-firecrawl-api-key",
    "brave_search_api_key": "your-brave-api-key"
  }'
```

### 4. Update Existing Secrets

To update secrets after deployment:

```bash
aws secretsmanager update-secret \
  --secret-id ai-digest-api-keys \
  --secret-string '{"openai_api_key": "new-api-key", ...}'
```

## Environment Variables (Fallback)

The application still supports environment variables as a fallback. If Secrets Manager fails or is not configured, it will use:

- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `FIRECRAWL_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `HELICONE_API_KEY`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `RESEND_FROM`

## Cost

AWS Secrets Manager costs approximately:
- $0.40 per secret per month
- $0.05 per 10,000 API calls

For this application with one secret and typical usage, expect ~$0.50/month.

## Security Benefits

1. **Encryption at Rest**: Secrets are encrypted using AWS KMS
2. **Access Control**: Fine-grained IAM permissions
3. **Audit Trail**: CloudTrail logs all access attempts
4. **Rotation Support**: Easy to rotate keys without code changes
5. **No Hardcoded Keys**: Removes API keys from environment variables

## Troubleshooting

### Lambda Can't Access Secrets

Check IAM permissions:
```bash
aws iam get-role-policy --role-name ai-digest-lambda-role --policy-name secrets-manager-access
```

### Secret Not Found

Verify the secret exists:
```bash
aws secretsmanager describe-secret --secret-id ai-digest-api-keys
```

### View Current Secret Value (Development Only)

```bash
aws secretsmanager get-secret-value --secret-id ai-digest-api-keys --query SecretString --output text | jq '.'
```

## Migration Checklist

- [x] AWS Secrets Manager client installed
- [x] Secrets loader utility created (`functions/lib/aws/secrets-loader.ts`)
- [x] Lambda handlers updated to load secrets
- [x] Terraform configuration includes secrets and IAM permissions
- [x] SECRET_ARN environment variable added to all Lambda functions
- [ ] Secrets created in AWS Secrets Manager
- [ ] Tested in development environment
- [ ] Deployed to production

## Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** for dev/staging/production
3. **Rotate keys regularly** (every 90 days recommended)
4. **Monitor access** via CloudTrail
5. **Use least privilege** IAM policies

## Support

For issues or questions about the secrets management implementation, refer to:
- AWS Secrets Manager [documentation](https://docs.aws.amazon.com/secretsmanager/)
- Project issue #85 for implementation details