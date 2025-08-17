# Multi-Cloud AI Digest Architecture

This project now supports deployment to both Azure Functions and AWS Lambda, with shared business logic and cloud-specific handlers.

## Architecture Overview

```
functions/
├── core/                    # Shared business logic
│   └── digest-processor.ts  # Main processing logic
├── lib/
│   ├── interfaces/          # Cloud-agnostic interfaces
│   │   ├── storage.ts       # Storage interface
│   │   └── logger.ts        # Logger interface
│   ├── azure/               # Azure implementations
│   │   └── storage.ts       # Azure Table Storage
│   ├── aws/                 # AWS implementations
│   │   └── storage.ts       # DynamoDB
│   └── [shared libs]        # Gmail, OpenAI, etc.
└── handlers/
    ├── azure/               # Azure Function handlers
    └── aws/                 # AWS Lambda handlers

terraform/
├── azure/                   # Azure infrastructure
└── aws/                     # AWS infrastructure
```

## Deployment

### Azure Deployment

```bash
# Configure environment
cp .env.example .env
# Edit .env with your Azure credentials

# Deploy to Azure
./bin/deploy-azure

# Or manually:
bun run build:azure
bun run zip
cd terraform/azure
terraform apply
```

### AWS Deployment

```bash
# Configure environment
cp .env.aws.example .env.aws
# Edit .env.aws with your AWS credentials

# Deploy to AWS
./bin/deploy-aws

# Or manually:
bun run build:aws
cd terraform/aws
terraform apply
```

## Service Mappings

| Azure Service | AWS Service | Purpose |
|--------------|-------------|---------|
| Azure Functions | Lambda | Serverless compute |
| Timer Trigger | EventBridge | Scheduled execution |
| HTTP Trigger | API Gateway | Manual trigger |
| Table Storage | DynamoDB | Processed email tracking |
| Key Vault | Secrets Manager | Secret storage |
| Application Insights | CloudWatch | Monitoring & logs |

## Environment Variables

### Shared Variables
- `GMAIL_CLIENT_ID` - Gmail OAuth client ID
- `GMAIL_CLIENT_SECRET` - Gmail OAuth client secret
- `GMAIL_REFRESH_TOKEN` - Gmail OAuth refresh token
- `OPENAI_API_KEY` - OpenAI API key
- `RESEND_API_KEY` - Resend email API key
- `RECIPIENT_EMAIL` - Email recipient

### Azure-Specific
- `AZURE_STORAGE_CONNECTION_STRING` - Storage account connection
- `WEEKLY_DIGEST_KEY` - Function key for internal calls

### AWS-Specific
- `AWS_REGION` - AWS region
- `DYNAMODB_TABLE_NAME` - DynamoDB table name
- `SECRET_ARN` - Secrets Manager ARN
- `WEEKLY_DIGEST_ARN` - Lambda function ARN

## Testing

### Test Azure Functions Locally
```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Start local runtime
func start
```

### Test AWS Lambda Locally
```bash
# Install SAM CLI
brew install aws-sam-cli

# Start local API
sam local start-api
```

## Monitoring

### Azure
- **Logs**: Azure Portal → Function App → Monitor → Logs
- **Metrics**: Application Insights → Metrics
- **Failures**: Application Insights → Failures

### AWS
- **Logs**: CloudWatch → Log Groups → `/aws/lambda/ai-digest-*`
- **Metrics**: CloudWatch → Metrics → Lambda
- **Traces**: X-Ray Console (if enabled)

## Cost Comparison

| Service | Azure | AWS |
|---------|-------|-----|
| Compute | ~$0.20/GB-s | ~$0.17/GB-s |
| Storage | ~$0.06/GB/mo | ~$0.25/GB/mo |
| Invocations | Free (1M) | Free (1M) |
| Data Transfer | ~$0.087/GB | ~$0.09/GB |

*Prices are approximate and vary by region*

## Switching Clouds

The architecture allows easy switching between clouds:

1. **Data Migration**: Export processed emails from one storage system and import to the other
2. **Update Secrets**: Configure the appropriate secret store with your credentials
3. **Deploy**: Run the deployment script for your chosen cloud
4. **Update DNS**: If using custom domains, update DNS to point to the new endpoint

## Development

### Adding New Features

1. **Core Logic**: Add to `functions/core/` for shared functionality
2. **Cloud-Specific**: Implement interfaces in `functions/lib/azure/` or `functions/lib/aws/`
3. **Handlers**: Update handlers in `functions/handlers/` for each cloud
4. **Infrastructure**: Update Terraform in both `terraform/azure/` and `terraform/aws/`

### Running Tests
```bash
bun test
```

### Linting
```bash
bun run lint
```

## Troubleshooting

### Azure Issues
- **Function not triggering**: Check timer expression in function.json
- **Storage errors**: Verify connection string in Key Vault
- **Auth failures**: Regenerate function keys

### AWS Issues
- **Lambda timeout**: Increase timeout in terraform (default 5 min)
- **DynamoDB throttling**: Switch to on-demand billing
- **API Gateway 403**: Check API key configuration

## Support

For issues or questions, please open an issue on GitHub.