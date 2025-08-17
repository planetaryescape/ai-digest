# Platform Identification & Scheduling Configuration

## Summary ✅

Your AI digest system is already configured correctly for platform identification and scheduling! Here's what's working:

## Platform Identification ✅

The email digest **already shows which platform generated it** in the footer:

### Email Footer Shows:

```
Generated [timestamp]
📍 Via Azure Functions  (for Azure-generated emails)
📍 Via AWS Lambda      (for AWS-generated emails)
```

### How It Works:

1. **AWS Handler** returns `platform: "aws"`
2. **Azure Handler** returns `platform: "azure"`
3. **DigestProcessor** passes platform to `sendDigest(summary, platform)`
4. **Email Template** (WeeklyDigestClean.tsx) displays platform in footer

## Scheduling Configuration ✅

Your scheduling is **already configured** to avoid race conditions:

### Current Schedule:

- **AWS Lambda**: Sundays at **8:00 AM UTC**
- **Azure Functions**: Sundays at **9:00 AM UTC** (1 hour later)

### Configuration Details:

#### AWS (EventBridge):

```
cron(0 8 ? * SUN *)  # 8 AM UTC every Sunday
```

#### Azure (NCrontab):

```json
{
  "schedule": "0 0 9 * * 0"  # 9 AM UTC every Sunday
}
```

## Files Updated:

- ✅ **`terraform/azure/outputs.tf`** - Updated documentation to clarify 9 AM UTC timing

## Testing Your Setup:

### 1. Test Platform Identification:

```bash
# Test AWS
curl -X POST https://YOUR_AWS_API_ID.execute-api.us-east-1.amazonaws.com/prod/run

# Test Azure
curl "https://YOUR_AZURE_APP.azurewebsites.net/api/run?code=YOUR_FUNCTION_KEY"
```

### 2. Check Email Footer:

When you receive digest emails, the footer will show:

- **📍 Via AWS Lambda** (from AWS deployment)
- **📍 Via Azure Functions** (from Azure deployment)

## No Changes Needed! 🎉

Your system is already properly configured:

- ✅ Platform identification working
- ✅ Azure runs 1 hour after AWS
- ✅ No race conditions
- ✅ Clear email footer indicators

You can now test both platforms and easily see which one generated each digest email!

## Schedule Summary:

```
Sunday Schedule (UTC):
├── 8:00 AM - AWS Lambda runs
└── 9:00 AM - Azure Functions runs (1 hour later)
```

Both deployments will generate identical digest content, but you'll be able to distinguish them by the platform indicator in the email footer.
