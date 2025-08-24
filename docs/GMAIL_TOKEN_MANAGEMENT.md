# Gmail Token Management Guide

## Overview

The AI Digest system uses OAuth2 authentication to access Gmail APIs. This guide explains how the token management system works and how to handle token-related issues.

## Architecture

### Components

1. **GmailTokenManager** (`functions/lib/gmail/token-manager.ts`)
   - Handles automatic token refresh
   - Provides token validation
   - Implements retry logic with exponential backoff
   - Caches tokens to minimize API calls

2. **GmailClient** (`functions/lib/gmail.ts`)
   - Uses TokenManager for all API calls
   - Automatically retries on auth failures
   - Provides health check capabilities

3. **GmailErrorHandler** (`functions/lib/gmail/gmail-error-handler.ts`)
   - Comprehensive error analysis
   - Automatic recovery strategies
   - User-friendly error messages

## Token Lifecycle

### Normal Flow
1. Initial token obtained via OAuth consent flow
2. Access token automatically refreshed before expiry (10-minute buffer)
3. Refresh token used to get new access tokens
4. Token cached in memory for performance

### Error Recovery
1. **401 Unauthorized**: Automatic token refresh attempted
2. **invalid_grant**: Indicates refresh token expired - manual regeneration required
3. **Rate limits**: Exponential backoff with retry
4. **Network errors**: Automatic retry with delay

## Managing Tokens

### Check Token Health

```bash
# Check current token status
bun run health:gmail

# Or directly via curl
curl https://your-api-url/gmail-health
```

### Refresh Token

```bash
# Interactive token management tool
bun run refresh:gmail
```

Options:
1. Test current token
2. Force refresh current token
3. Generate completely new token
4. Exit

### Generate New Token

If your refresh token is expired or invalid:

```bash
# Generate new OAuth token
bun run generate:oauth

# Or use the refresh tool
bun run refresh:gmail
# Select option 3
```

## Common Issues & Solutions

### Issue: "invalid_grant" Error

**Symptom**: 
```
Gmail authentication failed: invalid_grant
```

**Cause**: Refresh token has expired or been revoked

**Solution**:
1. Run `bun run refresh:gmail`
2. Select option 3 (Generate new token)
3. Follow the OAuth flow
4. Update environment variables

### Issue: Rate Limiting

**Symptom**:
```
Rate Limit Exceeded
quotaExceeded
```

**Cause**: Too many API requests

**Solution**:
- System automatically implements exponential backoff
- Reduce `MAX_EMAILS_PER_RUN` if persistent

### Issue: Token Expires Frequently

**Symptom**: Token needs manual refresh often

**Possible Causes**:
1. OAuth app not in production mode
2. Missing "offline" access type
3. Not forcing consent on token generation

**Solution**:
1. Ensure OAuth app is published in Google Cloud Console
2. When generating token, ensure these parameters:
   - `access_type: "offline"`
   - `prompt: "consent"`

## Environment Variables

Required Gmail OAuth variables:

```bash
# OAuth Client credentials
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token

# Recipient for digests
RECIPIENT_EMAIL=your-email@example.com
```

## AWS Deployment

### Update Secrets in AWS

```bash
# Update single secret
aws secretsmanager update-secret \
  --secret-id ai-digest-secrets \
  --secret-string '{"GMAIL_REFRESH_TOKEN":"new-token"}'

# Update all Gmail secrets
aws secretsmanager update-secret \
  --secret-id ai-digest-secrets \
  --secret-string '{
    "GMAIL_CLIENT_ID":"client-id",
    "GMAIL_CLIENT_SECRET":"client-secret",
    "GMAIL_REFRESH_TOKEN":"refresh-token"
  }'
```

### Deploy Updated Lambda

After updating secrets:

```bash
# Quick update (code only)
bun run update:aws

# Full deploy (with infrastructure)
bun run deploy:aws
```

## Monitoring

### Health Check Endpoint

The `/gmail-health` endpoint provides:
- Token validity status
- Time until expiry
- Refresh attempt count
- Last refresh timestamp
- Recommendations

### CloudWatch Logs

Monitor for these patterns:
- `"Auth error during"` - Token refresh attempts
- `"Token refresh failed"` - Critical auth issues
- `"Successfully refreshed Gmail access token"` - Successful recoveries

### Metrics to Track
- Token refresh frequency
- Auth failure rate
- API call success rate
- Token expiry buffer time

## Best Practices

1. **Regular Health Checks**
   - Set up monitoring on `/gmail-health`
   - Alert if token expires in < 1 hour

2. **Proactive Refresh**
   - System refreshes tokens 10 minutes before expiry
   - Manual refresh if planning maintenance

3. **Error Handling**
   - Let the system retry automatically
   - Only regenerate tokens when explicitly required

4. **Security**
   - Never commit tokens to git
   - Use AWS Secrets Manager in production
   - Rotate tokens periodically

## Troubleshooting Checklist

1. ✅ Check token health: `bun run health:gmail`
2. ✅ Try force refresh: `bun run refresh:gmail` (option 2)
3. ✅ Check CloudWatch logs for specific errors
4. ✅ Verify OAuth app settings in Google Cloud Console
5. ✅ Ensure Gmail API is enabled
6. ✅ Check API quotas in Google Cloud Console
7. ✅ Generate new token if all else fails

## Token Expiry Timeline

- **Access Token**: Valid for 1 hour
- **Refresh Token**: Valid until:
  - Explicitly revoked
  - Not used for 6 months
  - User changes password
  - OAuth app settings changed
  - Too many tokens issued (limit ~50)

## Support

If token issues persist:
1. Check CloudWatch logs for detailed error messages
2. Review Google Cloud Console for API errors
3. Ensure OAuth consent screen is properly configured
4. Verify all required scopes are granted