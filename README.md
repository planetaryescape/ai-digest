# AI Digest - Weekly Newsletter Summarizer

An automated system that fetches AI-related newsletters from your Gmail, summarizes them using GPT-5, and sends you a beautifully formatted weekly digest with role-specific advice and product opportunities.

## Features

- 📧 **Gmail Integration**: Automatically fetches and filters AI-related emails
- 🤖 **GPT-5 Summarization**: Intelligent summaries with web search for fact-checking
- 💼 **Role-Based Advice**: Actionable tips for various professions (engineering, finance, law, teaching, etc.)
- 🚀 **Product Plays**: Specific suggestions for your apps based on weekly news
- 📊 **State Tracking**: Azure Table Storage prevents re-processing emails
- 💰 **Cost Optimized**: Uses Azure Consumption plan and GPT-5-mini by default
- 🎨 **Beautiful Emails**: React Email + Tailwind for professional formatting

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- Azure account with CLI configured
- Google Cloud project with Gmail API enabled
- OpenAI API key
- Helicone API key (for observability)
- Resend API key (for sending emails)
- [Doppler](https://doppler.com) (optional, for secrets management)
- [Terraform](https://terraform.io) installed

### 1. Clone and Install

```bash
git clone <your-repo>
cd ai-digest
bun install
```

### 2. Generate Gmail OAuth Token

First, set up Google Cloud:
1. Create a new project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials (Desktop application type)
4. Download the credentials

Then generate your refresh token:

```bash
bun run generate:oauth
```

Follow the prompts to get your `GMAIL_REFRESH_TOKEN`.

### 3. Configure Environment

Copy the example file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your values:
- Gmail OAuth credentials
- OpenAI API key
- Helicone API key
- Resend API key
- Recipient email

### 4. Build Functions

```bash
# With Doppler (recommended)
./bin/build

# Without Doppler
bun run build:functions
bun run zip
```

### 5. Deploy to Azure

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply -auto-approve
```

### 6. Add Secrets to Key Vault

After deployment, add your secrets:

```bash
# Get the Key Vault name from Terraform output
export KV_NAME=$(terraform output -raw key_vault_name)

# Add secrets
az keyvault secret set --vault-name $KV_NAME --name gmail-client-id --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name gmail-client-secret --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name gmail-refresh-token --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name openai-api-key --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name helicone-api-key --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name resend-api-key --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name resend-from --value "AI Digest <digest@yourdomain.com>"
```

### 7. Test Manual Trigger

Get the function key and test:

```bash
# Get function key
az functionapp function keys list \
  --name $(terraform output -raw function_app_name) \
  --resource-group $(terraform output -raw resource_group_name) \
  --function-name run-now

# Test trigger
curl "$(terraform output -raw manual_trigger_url)?code=FUNCTION_KEY"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RECIPIENT_EMAIL` | Email to send digests to | Required |
| `OPENAI_MODEL` | GPT model to use | `gpt-5-mini` |
| `OLDER_THAN_DAYS` | Archive emails older than | `30` |
| `MAX_LINKS_PER_EMAIL` | Links to fetch per email | `2` |
| `MAX_SECTIONS` | Max emails to summarize | `25` |
| `KEYWORDS` | Additional AI keywords | `""` |
| `PROFESSIONS` | Roles for advice generation | Multiple roles |

### Your Apps Configuration

Edit `PRODUCT_CONTEXT` in `terraform/main.tf` to customize product plays:

```hcl
PRODUCT_CONTEXT = jsonencode({
  owner = "Your Name"
  apps = [
    {
      name = "App Name"
      url  = "https://example.com"
      desc = "Description"
    }
  ]
})
```

## Weekly Schedule

The digest runs automatically every Sunday at 8:00 AM (London time with DST).

To change the schedule, edit `functions/weekly-digest/function.json`:
```json
"schedule": "0 0 8 * * 0"  // Cron expression
```

## Cost Optimization

This system is designed to run within free/minimal tiers:

- **Azure Functions**: Consumption plan (1M free executions/month)
- **Azure Storage**: 5GB free
- **GPT-5-mini**: ~$0.01 per digest
- **Helicone**: Caching reduces API calls
- **Weekly runs**: 52 executions/year

Estimated monthly cost: < $1

## Monitoring

### View Logs

```bash
# Real-time logs
az webapp log tail \
  --name $(terraform output -raw function_app_name) \
  --resource-group $(terraform output -raw resource_group_name)

# Application Insights (if enabled)
# Visit Azure Portal -> Application Insights
```

### Helicone Dashboard

Visit [Helicone Dashboard](https://helicone.ai) to see:
- Token usage
- Cost tracking
- Cache hit rates
- Request latency

## Development

### Local Email Preview

```bash
bun run dev:email
# Visit http://localhost:3000
```

### Update Dependencies

```bash
bun update
```

### Clean Build

```bash
rm -rf terraform/artifacts
./bin/build
```

## Troubleshooting

### Gmail Auth Issues
- Ensure Gmail API is enabled
- Verify OAuth scope includes `gmail.modify`
- Regenerate refresh token if expired

### Azure Deployment Issues
- Check function app logs in Azure Portal
- Verify Key Vault secrets are set correctly
- Ensure managed identity has Key Vault access

### Email Not Sending
- Verify Resend API key and sender domain
- Check Resend dashboard for bounces/blocks
- Ensure recipient email is correct

## Architecture

```
Gmail API → Azure Functions → GPT-5 → Resend
     ↓           ↓              ↓        ↓
  Emails    Table Storage   Summary   Digest
```

## License

MIT

## Support

For issues or questions, contact digest@bhekani.com