# Secrets Management Guide

## Overview

AI Digest now uses AWS Secrets Manager for secure storage of API keys and credentials, eliminating the security risks of storing sensitive data in environment variables.

## Architecture

### Previous (Insecure) Approach ❌
- API keys stored in Lambda environment variables
- Visible in AWS Console
- Logged in CloudWatch
- No rotation mechanism
- High risk of exposure

### New (Secure) Approach ✅
- All secrets stored in AWS Secrets Manager
- Encrypted at rest with AWS KMS
- Secrets loaded on Lambda cold start
- Support for secret rotation
- No sensitive data in environment variables

## Initial Setup

### 1. Prerequisites
- AWS CLI configured with appropriate credentials
- `.env.aws` file with your API keys
- Terraform installed

### 2. Initialize Secrets

Run the initialization script to create secrets in AWS:

```bash
./scripts/init-secrets.sh
```

This script will:
- Read API keys from `.env.aws`
- Create a secret in AWS Secrets Manager
- Store all credentials securely
- Output the secret ARN for reference

### 3. Deploy Infrastructure

Deploy the updated Lambda functions with Terraform:

```bash
npm run deploy:aws
```

The deployment will:
- Create IAM policies for Secrets Manager access
- Configure Lambda functions with SECRET_ARN
- Remove sensitive environment variables

## Secret Structure

The secret is stored as JSON with the following structure:

```json
{
  "gmail_client_id": "your-gmail-client-id",
  "gmail_client_secret": "your-gmail-client-secret",
  "gmail_refresh_token": "your-gmail-refresh-token",
  "openai_api_key": "your-openai-api-key",
  "helicone_api_key": "your-helicone-api-key",
  "resend_api_key": "your-resend-api-key",
  "resend_from": "recipient@example.com"
}
```

## Lambda Implementation

### How It Works

1. **Cold Start**: When a Lambda function starts, it loads secrets from AWS Secrets Manager
2. **Caching**: Secrets are cached in memory for the lifetime of the Lambda container
3. **Environment Variables**: Secrets are injected into process.env for backward compatibility
4. **Error Handling**: Functions continue with graceful degradation if secrets fail to load

### Code Example

```typescript
// Automatic loading in Lambda handlers
import { SecretsLoader } from "../../lib/aws/secrets-loader";

async function handler(event: any, context: Context) {
  // Load secrets on cold start
  await SecretsLoader.loadSecrets();
  
  // Secrets are now available in process.env
  const apiKey = process.env.OPENAI_API_KEY;
  // ... rest of handler logic
}
```

## Secret Rotation

### Manual Rotation

Use the rotation script to update individual secrets:

```bash
./scripts/rotate-secrets.sh
```

The script provides options to:
- Rotate individual API keys
- Rotate all secrets at once
- Update credentials without downtime

### Rotation Process

1. **Update Secret**: New secret version is created in AWS Secrets Manager
2. **Lambda Cold Start**: Next Lambda invocation loads the new secrets
3. **Zero Downtime**: Running Lambda containers continue with old secrets until restart

### Best Practices

- Rotate secrets regularly (every 90 days)
- Use different API keys for development and production
- Monitor secret access in CloudWatch
- Enable AWS Secrets Manager automatic rotation for supported services

## Cost Analysis

### AWS Secrets Manager Pricing
- **Storage**: $0.40/month per secret
- **API Calls**: $0.05 per 10,000 API calls
- **Rotation**: No additional cost for manual rotation

### Monthly Cost Estimate
- 1 secret: $0.40
- ~1000 Lambda invocations: $0.01
- **Total**: ~$0.41/month

## Security Benefits

### 1. Encryption at Rest
- Secrets encrypted using AWS KMS
- Automatic key rotation available
- Compliance with security standards

### 2. Access Control
- Fine-grained IAM policies
- Only Lambda functions can access secrets
- Audit trail in CloudWatch

### 3. Secret Rotation
- Easy credential updates
- No code changes required
- Zero-downtime rotation

### 4. Reduced Attack Surface
- No secrets in environment variables
- No secrets in CloudWatch logs
- No secrets in Lambda console

## Troubleshooting

### Common Issues

#### 1. "Failed to load secrets" Error
- **Cause**: Lambda doesn't have permission to access Secrets Manager
- **Solution**: Check IAM role has `secretsmanager:GetSecretValue` permission

#### 2. "Secret not found" Error
- **Cause**: Secret doesn't exist or wrong region
- **Solution**: Run `init-secrets.sh` or check AWS_REGION

#### 3. Configuration Validation Fails
- **Cause**: Secrets not loaded before validation
- **Solution**: Ensure SecretsLoader.loadSecrets() is called first

### Debug Commands

```bash
# Check if secret exists
aws secretsmanager describe-secret --secret-id ai-digest-api-keys

# Get secret value (be careful!)
aws secretsmanager get-secret-value --secret-id ai-digest-api-keys

# Check Lambda environment variables
aws lambda get-function-configuration --function-name ai-digest-weekly-digest
```

## Migration Checklist

- [x] Create AWS Secrets Manager secret
- [x] Update Terraform configuration
- [x] Add IAM policies for Secrets Manager
- [x] Update Lambda handlers to load secrets
- [x] Remove sensitive environment variables from Terraform
- [x] Create initialization script
- [x] Create rotation script
- [x] Document the process
- [ ] Test secret loading in all Lambda functions
- [ ] Verify no secrets in CloudWatch logs
- [ ] Set up secret rotation schedule

## Next Steps

1. **Enable Automatic Rotation**: Configure AWS Secrets Manager to automatically rotate secrets
2. **Add Monitoring**: Set up CloudWatch alarms for failed secret access
3. **Implement Secret Versioning**: Track secret versions for rollback capability
4. **Add Multi-Region Support**: Replicate secrets across regions for disaster recovery