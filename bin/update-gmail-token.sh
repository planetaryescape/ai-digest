#!/bin/bash

# Script to update Gmail OAuth token in Azure Key Vault

set -e

echo "🔐 Updating Gmail OAuth credentials in Azure Key Vault..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it with your Gmail OAuth credentials."
    exit 1
fi

# Load credentials from .env
export $(cat .env | grep -E "^GMAIL_" | xargs)

if [ -z "$GMAIL_CLIENT_ID" ] || [ -z "$GMAIL_CLIENT_SECRET" ]; then
    echo "❌ GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env"
    exit 1
fi

echo "📝 Current credentials:"
echo "   Client ID: ${GMAIL_CLIENT_ID:0:20}..."
echo "   Client Secret: ${GMAIL_CLIENT_SECRET:0:10}..."

# Update Key Vault secrets
echo ""
echo "🔄 Updating Key Vault secrets..."

az keyvault secret set \
    --vault-name kv-ai-digest-unique \
    --name gmail-client-id \
    --value "$GMAIL_CLIENT_ID" \
    --output none

echo "✅ Updated gmail-client-id"

az keyvault secret set \
    --vault-name kv-ai-digest-unique \
    --name gmail-client-secret \
    --value "$GMAIL_CLIENT_SECRET" \
    --output none

echo "✅ Updated gmail-client-secret"

if [ ! -z "$GMAIL_REFRESH_TOKEN" ]; then
    az keyvault secret set \
        --vault-name kv-ai-digest-unique \
        --name gmail-refresh-token \
        --value "$GMAIL_REFRESH_TOKEN" \
        --output none
    echo "✅ Updated gmail-refresh-token"
else
    echo "⚠️  GMAIL_REFRESH_TOKEN not found in .env"
    echo "   Run 'bun run generate:oauth' to generate a new refresh token"
fi

echo ""
echo "✅ Gmail OAuth credentials updated in Key Vault!"
echo ""
echo "Next steps:"
echo "1. If you haven't generated a refresh token yet, run:"
echo "   bun run generate:oauth"
echo ""
echo "2. Then update the refresh token in Key Vault:"
echo "   az keyvault secret set --vault-name kv-ai-digest-unique --name gmail-refresh-token --value 'YOUR_REFRESH_TOKEN'"
echo ""
echo "3. Test the function:"
echo "   curl 'https://fn-ai-digest-unique.azurewebsites.net/api/run?code=YOUR_FUNCTION_KEY'"