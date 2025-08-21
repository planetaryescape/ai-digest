# AI Digest - Weekly Newsletter Summarizer

An automated system that fetches AI-related newsletters from your Gmail, summarizes them using GPT models, and sends you a beautifully formatted weekly digest with role-specific advice and product opportunities.

## Features

- 📧 **Gmail Integration**: Automatically fetches and filters AI-related emails
- 🤖 **AI-Powered Summarization**: Intelligent summaries with web search for fact-checking
- 💼 **Role-Based Advice**: Actionable tips for various professions
- 🚀 **Product Opportunities**: Specific suggestions for your apps based on weekly news
- 💰 **Cost Optimized**: Uses consumption-based pricing on both Azure and AWS
- 🎨 **Beautiful Emails**: React Email + Tailwind for professional formatting

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- Azure account or AWS account configured
- Google Cloud project with Gmail API enabled
- OpenAI API key
- Resend API key for email delivery

### Installation

```bash
git clone <your-repo>
cd ai-digest
bun install
```

### Generate Gmail OAuth Token

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials (Desktop application type)
4. Download the credentials

Then generate your refresh token:

```bash
bun run generate:oauth
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
- Gmail OAuth credentials
- OpenAI API key
- Resend API key
- Recipient email address

### Deploy

#### Deploy to AWS

```bash
bun run deploy:aws
```

#### Deploy to Azure

```bash
bun run deploy:azure
```

### Test the System

```bash
# Regular weekly digest (last 7 days)
curl https://your-function-url/run-now

# Cleanup mode (process ALL unarchived emails)
curl "https://your-function-url/run-now?cleanup=true"
```

## Configuration

### Processing Modes

- **Weekly Mode** (default): Processes emails from the last 7 days
- **Cleanup Mode**: Processes ALL unarchived emails in batches

### Customization

Edit your product context in the Terraform configuration to get personalized product recommendations:

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

### Schedule

The digest runs automatically every Sunday at 8:00 AM. To change the schedule:
- **AWS**: Edit EventBridge rule in Terraform
- **Azure**: Edit timer trigger in function.json

## Development

### Local Development

```bash
# Preview email templates
bun run dev:email

# Run tests
bun run test

# Type checking
bun run typecheck

# Linting
bun run lint
```

### Building

```bash
# Build for both platforms
bun run build:all

# Build for specific platform
bun run build:aws
bun run build:azure
```

## Cost

Designed to run within free/minimal tiers:
- **Compute**: < $1/month (serverless functions)
- **Storage**: < $1/month (minimal data)
- **OpenAI**: ~$0.01-0.10 per digest
- **Total**: < $5/month

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [CORS Setup Guide](docs/CORS_SETUP.md)
- [Prompt Optimization](docs/PROMPT_OPTIMIZATION.md)
- [Development Guide](CLAUDE.md)

## Troubleshooting

### Gmail Auth Issues
- Ensure Gmail API is enabled
- Verify OAuth scope includes `gmail.modify`
- Regenerate refresh token if expired

### Deployment Issues
- Check function logs in CloudWatch (AWS) or Application Insights (Azure)
- Verify all secrets are configured correctly
- Ensure managed identity/IAM roles have proper permissions

### Email Not Sending
- Verify Resend API key and sender domain
- Check Resend dashboard for bounces/blocks
- Ensure recipient email is correct

## Support

For issues or questions, please open an issue on GitHub.

## License

MIT