#!/bin/bash

# Get Lambda function ARNs
EMAIL_FETCHER_ARN=$(aws lambda get-function --function-name ai-digest-sf-email-fetcher --region us-east-1 --query 'Configuration.FunctionArn' --output text)
CLASSIFIER_ARN=$(aws lambda get-function --function-name ai-digest-sf-classifier --region us-east-1 --query 'Configuration.FunctionArn' --output text)
CONTENT_EXTRACTOR_ARN=$(aws lambda get-function --function-name ai-digest-sf-content-extractor --region us-east-1 --query 'Configuration.FunctionArn' --output text)
RESEARCH_ARN=$(aws lambda get-function --function-name ai-digest-sf-research --region us-east-1 --query 'Configuration.FunctionArn' --output text)
ANALYSIS_ARN=$(aws lambda get-function --function-name ai-digest-sf-analysis --region us-east-1 --query 'Configuration.FunctionArn' --output text)
CRITIC_ARN=$(aws lambda get-function --function-name ai-digest-sf-critic --region us-east-1 --query 'Configuration.FunctionArn' --output text)
DIGEST_SENDER_ARN=$(aws lambda get-function --function-name ai-digest-sf-digest-sender --region us-east-1 --query 'Configuration.FunctionArn' --output text)
ERROR_HANDLER_ARN=$(aws lambda get-function --function-name ai-digest-sf-error-handler --region us-east-1 --query 'Configuration.FunctionArn' --output text)

# Read the template and substitute ARNs
cat aws/stepfunctions/ai-digest-pipeline.asl.json | \
sed "s|\${email_fetcher_arn}|$EMAIL_FETCHER_ARN|g" | \
sed "s|\${classifier_arn}|$CLASSIFIER_ARN|g" | \
sed "s|\${content_extractor_arn}|$CONTENT_EXTRACTOR_ARN|g" | \
sed "s|\${research_arn}|$RESEARCH_ARN|g" | \
sed "s|\${analysis_arn}|$ANALYSIS_ARN|g" | \
sed "s|\${critic_arn}|$CRITIC_ARN|g" | \
sed "s|\${digest_sender_arn}|$DIGEST_SENDER_ARN|g" | \
sed "s|\${error_handler_arn}|$ERROR_HANDLER_ARN|g" > temp-definition.json

# Create the state machine
aws stepfunctions create-state-machine \
  --name "ai-digest-pipeline" \
  --role-arn "arn:aws:iam::536697242054:role/ai-digest-stepfunctions-role" \
  --definition file://temp-definition.json \
  --type EXPRESS \
  --logging-configuration '{
    "level": "ALL",
    "includeExecutionData": true,
    "destinations": [{
      "cloudWatchLogsLogGroup": {
        "logGroupArn": "arn:aws:logs:us-east-1:536697242054:log-group:/aws/vendedlogs/states/ai-digest-pipeline:*"
      }
    }]
  }' \
  --region us-east-1

echo "State machine created successfully!"
