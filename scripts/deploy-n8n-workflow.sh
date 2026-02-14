#!/usr/bin/env bash
set -euo pipefail

# Deploy AI Digest Podcast workflow to n8n
# Usage: ./scripts/deploy-n8n-workflow.sh

N8N_URL="${N8N_URL:-https://n8n.planetaryescape.cloud}"
N8N_API_KEY="${N8N_API_KEY:?Set N8N_API_KEY environment variable}"
WORKFLOW_FILE="$(dirname "$0")/../n8n-workflows/ai-digest-podcast.json"

if [ ! -f "$WORKFLOW_FILE" ]; then
  echo "Error: Workflow file not found at $WORKFLOW_FILE"
  exit 1
fi

echo "Deploying AI Digest Podcast workflow to $N8N_URL..."

# Strip fields the API doesn't accept (tags, pinData, etc)
PAYLOAD=$(python3 -c "
import sys, json
with open('$WORKFLOW_FILE') as f:
    data = json.load(f)
allowed = ['name', 'nodes', 'connections', 'settings', 'staticData']
print(json.dumps({k: v for k, v in data.items() if k in allowed}))
")

# Check if workflow already exists (by name)
EXISTING=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/workflows" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
workflows = data.get('data', [])
for w in workflows:
    if w.get('name') == 'AI Digest Daily Podcast':
        print(w['id'])
        break
" 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
  echo "Workflow already exists (ID: $EXISTING). Updating..."
  HTTP_CODE=$(echo "$PAYLOAD" | curl -s -w '%{http_code}' -o /dev/null -X PUT \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @- \
    "$N8N_URL/api/v1/workflows/$EXISTING")
  WORKFLOW_ID="$EXISTING"

  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "Error updating workflow (HTTP $HTTP_CODE)"
    exit 1
  fi
  echo "Updated successfully."
else
  echo "Creating new workflow..."
  RESPONSE=$(echo "$PAYLOAD" | curl -s -w '\n%{http_code}' -X POST \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -d @- \
    "$N8N_URL/api/v1/workflows")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -ge 400 ]; then
    echo "Error creating workflow (HTTP $HTTP_CODE):"
    echo "$BODY"
    exit 1
  fi

  WORKFLOW_ID=$(echo "$BODY" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
  echo "Created workflow with ID: $WORKFLOW_ID"
fi

# Activate the workflow
echo "Activating workflow..."
ACTIVATE_CODE=$(curl -s -w '%{http_code}' -o /dev/null -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  "$N8N_URL/api/v1/workflows/$WORKFLOW_ID/activate")

if [ "$ACTIVATE_CODE" -ge 400 ]; then
  echo "Warning: Failed to activate (HTTP $ACTIVATE_CODE). Activate manually in n8n UI."
else
  echo "Workflow activated!"
fi

echo ""
echo "Done! Workflow URL: $N8N_URL/workflow/$WORKFLOW_ID"
