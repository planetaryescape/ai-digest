#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Deploying AI Digest Monitoring Infrastructure"
echo "================================================"

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured. Please run 'aws configure'"
    exit 1
fi

# Get AWS region
AWS_REGION=$(aws configure get region)
if [ -z "$AWS_REGION" ]; then
    echo "❌ AWS region not configured. Please set it with 'aws configure set region <region>'"
    exit 1
fi

echo "📍 Using AWS Region: $AWS_REGION"
echo ""

# Navigate to terraform directory
cd "$PROJECT_ROOT/terraform/aws"

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    echo "📦 Initializing Terraform..."
    terraform init
fi

# Plan the monitoring changes
echo "📋 Planning monitoring infrastructure..."
terraform plan -target=aws_cloudwatch_dashboard.ai_digest_main \
               -target=aws_cloudwatch_dashboard.ai_digest_costs \
               -target=aws_cloudwatch_dashboard.ai_digest_agents \
               -target=aws_cloudwatch_metric_alarm.lambda_errors \
               -target=aws_cloudwatch_metric_alarm.lambda_throttles \
               -target=aws_cloudwatch_metric_alarm.lambda_duration \
               -target=aws_cloudwatch_metric_alarm.api_gateway_4xx \
               -target=aws_cloudwatch_metric_alarm.api_gateway_5xx \
               -target=aws_cloudwatch_metric_alarm.dynamodb_errors \
               -target=aws_s3_bucket_metric.processed_emails_metrics \
               -out=monitoring.tfplan

echo ""
read -p "📊 Review the plan above. Deploy monitoring? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying monitoring infrastructure..."
    terraform apply monitoring.tfplan
    
    echo ""
    echo "✅ Monitoring infrastructure deployed successfully!"
    echo ""
    echo "📊 Dashboard URLs:"
    echo "=================="
    
    # Get dashboard URLs from Terraform outputs
    MAIN_DASHBOARD=$(terraform output -raw main_dashboard_url 2>/dev/null || echo "")
    COST_DASHBOARD=$(terraform output -raw cost_dashboard_url 2>/dev/null || echo "")
    AGENTS_DASHBOARD=$(terraform output -raw agents_dashboard_url 2>/dev/null || echo "")
    
    if [ -n "$MAIN_DASHBOARD" ]; then
        echo "📈 Main Dashboard: $MAIN_DASHBOARD"
    fi
    if [ -n "$COST_DASHBOARD" ]; then
        echo "💰 Cost Dashboard: $COST_DASHBOARD"
    fi
    if [ -n "$AGENTS_DASHBOARD" ]; then
        echo "🤖 Agents Dashboard: $AGENTS_DASHBOARD"
    fi
    
    echo ""
    echo "🔔 CloudWatch Alarms configured:"
    echo "================================="
    echo "• Lambda Errors (threshold: 5 errors in 10 min)"
    echo "• Lambda Throttles (threshold: any throttles)"
    echo "• Lambda Duration (threshold: >4 minutes)"
    echo "• API Gateway 4XX Errors (threshold: >10 in 10 min)"
    echo "• API Gateway 5XX Errors (threshold: >5 in 5 min)"
    echo "• DynamoDB Errors (threshold: >5 in 10 min)"
    
    echo ""
    echo "💡 Tips:"
    echo "========"
    echo "• View real-time metrics in CloudWatch dashboards"
    echo "• Set up SNS topic for alarm notifications"
    echo "• Consider adding custom metrics from your Lambda functions"
    echo "• Use CloudWatch Insights for advanced log analysis"
    
    # Clean up plan file
    rm -f monitoring.tfplan
else
    echo "❌ Deployment cancelled"
    rm -f monitoring.tfplan
    exit 1
fi