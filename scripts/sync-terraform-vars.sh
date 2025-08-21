#!/usr/bin/env bash

set -euo pipefail

# Check if .env.aws exists
if [ ! -f ".env.aws" ]; then
    echo "❌ .env.aws file not found"
    exit 1
fi

# Create terraform.tfvars from .env.aws
echo "📝 Generating terraform.tfvars from .env.aws..."

cat > terraform/aws/terraform.tfvars << 'EOF'
# This file is auto-generated from .env.aws
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

EOF

# Source the .env.aws file and export variables
set -a
source .env.aws
set +a

# Write the variables to terraform.tfvars
cat >> terraform/aws/terraform.tfvars << EOF
# AWS Configuration
AWS_REGION = "${AWS_REGION:-us-east-1}"

# Gmail OAuth Configuration
GMAIL_CLIENT_ID     = "${GMAIL_CLIENT_ID}"
GMAIL_CLIENT_SECRET = "${GMAIL_CLIENT_SECRET}"
GMAIL_REFRESH_TOKEN = "${GMAIL_REFRESH_TOKEN}"

# OpenAI Configuration
OPENAI_API_KEY   = "${OPENAI_API_KEY}"
HELICONE_API_KEY = "${HELICONE_API_KEY}"

# Email Service Configuration
RESEND_API_KEY  = "${RESEND_API_KEY}"
RECIPIENT_EMAIL = "${RECIPIENT_EMAIL}"

# Firecrawl Configuration (optional)
ENABLE_FIRECRAWL  = ${ENABLE_FIRECRAWL:-true}
FIRECRAWL_API_KEY = "${FIRECRAWL_API_KEY:-}"

# Brave Search Configuration (optional)
ENABLE_RESEARCH = ${ENABLE_RESEARCH:-true}
BRAVE_API_KEY   = "${BRAVE_API_KEY:-}"

# Processing Configuration
older_than_days     = ${OLDER_THAN_DAYS:-30}
max_links_per_email = ${MAX_LINKS_PER_EMAIL:-2}
max_sections        = ${MAX_SECTIONS:-25}
keywords            = "${KEYWORDS:-}"
professions         = "${PROFESSIONS:-}"

# CORS Configuration
allowed_origins = ["http://localhost:3000", "https://ai-digest.vercel.app"]
EOF

echo "✅ terraform.tfvars generated successfully"

# Add to .gitignore if not already there
if ! grep -q "terraform.tfvars" terraform/aws/.gitignore 2>/dev/null; then
    echo "terraform.tfvars" >> terraform/aws/.gitignore
    echo "📝 Added terraform.tfvars to .gitignore"
fi