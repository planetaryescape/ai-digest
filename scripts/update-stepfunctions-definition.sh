#!/bin/bash

# Replace placeholders with actual Lambda ARNs
cat terraform/aws/stepfunctions/ai-digest-pipeline.asl.json | \
  sed 's/${email_fetcher_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-email-fetcher/g' | \
  sed 's/${classifier_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-classifier/g' | \
  sed 's/${content_extractor_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-content-extractor/g' | \
  sed 's/${research_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-research/g' | \
  sed 's/${analysis_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-analysis/g' | \
  sed 's/${critic_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-critic/g' | \
  sed 's/${digest_sender_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-digest-sender/g' | \
  sed 's/${error_handler_arn}/arn:aws:lambda:us-east-1:536697242054:function:ai-digest-sf-error-handler/g' \
  > /tmp/ai-digest-pipeline-resolved.json

# Update the state machine
aws stepfunctions update-state-machine \
  --region us-east-1 \
  --state-machine-arn arn:aws:states:us-east-1:536697242054:stateMachine:ai-digest-pipeline \
  --definition file:///tmp/ai-digest-pipeline-resolved.json

echo "✅ Step Functions definition updated with actual Lambda ARNs"