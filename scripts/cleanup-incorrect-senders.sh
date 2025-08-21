#!/bin/bash

# Clean up incorrectly stored senders (those stored with email IDs instead of email addresses)

echo "Cleaning up incorrectly stored senders from DynamoDB..."

# Get all items where senderEmail looks like an ID (starts with 19)
echo "Finding incorrect entries in ai-digest-known-ai-senders..."
aws dynamodb scan \
  --table-name ai-digest-known-ai-senders \
  --region us-east-1 \
  --filter-expression "begins_with(senderEmail, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"19"}}' \
  --query "Items[].senderEmail.S" \
  --output text | tr '\t' '\n' | while read sender_id; do
    if [ ! -z "$sender_id" ]; then
      echo "Deleting incorrect entry: $sender_id"
      aws dynamodb delete-item \
        --table-name ai-digest-known-ai-senders \
        --region us-east-1 \
        --key "{\"senderEmail\": {\"S\": \"$sender_id\"}}" \
        2>/dev/null
    fi
done

echo "Finding incorrect entries in ai-digest-known-non-ai-senders..."
aws dynamodb scan \
  --table-name ai-digest-known-non-ai-senders \
  --region us-east-1 \
  --filter-expression "begins_with(senderEmail, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"19"}}' \
  --query "Items[].senderEmail.S" \
  --output text | tr '\t' '\n' | while read sender_id; do
    if [ ! -z "$sender_id" ]; then
      echo "Deleting incorrect entry: $sender_id"
      aws dynamodb delete-item \
        --table-name ai-digest-known-non-ai-senders \
        --region us-east-1 \
        --key "{\"senderEmail\": {\"S\": \"$sender_id\"}}" \
        2>/dev/null
    fi
done

echo "Cleanup complete!"

# Show remaining valid entries
echo ""
echo "Remaining valid AI senders:"
aws dynamodb scan \
  --table-name ai-digest-known-ai-senders \
  --region us-east-1 \
  --query "Count" \
  --output text

echo "Remaining valid non-AI senders:"
aws dynamodb scan \
  --table-name ai-digest-known-non-ai-senders \
  --region us-east-1 \
  --query "Count" \
  --output text