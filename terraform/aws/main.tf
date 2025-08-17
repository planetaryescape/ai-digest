terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# S3 bucket for Lambda deployments
resource "aws_s3_bucket" "lambda_deployments" {
  bucket = "${var.project_name}-lambda-deployments-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket for processed emails
resource "aws_s3_bucket" "processed_emails" {
  bucket = "${var.project_name}-processed-emails-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# DynamoDB table for known AI senders
resource "aws_dynamodb_table" "known_ai_senders" {
  name           = "${var.project_name}-known-ai-senders"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "senderEmail"

  attribute {
    name = "senderEmail"
    type = "S"
  }

  attribute {
    name = "domain"
    type = "S"
  }

  global_secondary_index {
    name            = "DomainIndex"
    hash_key        = "domain"
    projection_type = "ALL"
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_versioning" "processed_emails" {
  bucket = aws_s3_bucket.processed_emails.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach AWS managed policy for Lambda basic execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Comment out inline policies - user doesn't have IAM permissions
# Instead, use S3 bucket policy to grant access

# S3 bucket policy to allow Lambda access
resource "aws_s3_bucket_policy" "processed_emails_policy" {
  bucket = aws_s3_bucket.processed_emails.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.lambda_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.processed_emails.arn,
          "${aws_s3_bucket.processed_emails.arn}/*"
        ]
      }
    ]
  })
}

# IAM policy for DynamoDB access
resource "aws_iam_policy" "dynamodb_access" {
  name = "${var.project_name}-dynamodb-access"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem"
        ]
        Resource = [
          aws_dynamodb_table.known_ai_senders.arn,
          "${aws_dynamodb_table.known_ai_senders.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.dynamodb_access.arn
}

# IAM policy for Lambda invoke permissions
resource "aws_iam_policy" "lambda_invoke" {
  name = "${var.project_name}-lambda-invoke"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-weekly-digest"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_invoke_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_invoke.arn
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "weekly_digest" {
  name              = "/aws/lambda/${var.project_name}-weekly-digest"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "run_now" {
  name              = "/aws/lambda/${var.project_name}-run-now"
  retention_in_days = 7
}

# Package Lambda functions
resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.lambda_deployments.id
  key    = "lambda-package-${timestamp()}.zip"
  source = "${path.module}/../../terraform/artifacts/lambda.zip"
  etag   = filemd5("${path.module}/../../terraform/artifacts/lambda.zip")
}

# Lambda function for weekly digest
resource "aws_lambda_function" "weekly_digest" {
  function_name = "${var.project_name}-weekly-digest"
  role          = aws_iam_role.lambda_role.arn
  handler       = "weekly-digest.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 512

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.lambda_package.key

  environment {
    variables = {
      # Storage configuration
      STORAGE_TYPE = "s3"
      S3_BUCKET    = aws_s3_bucket.processed_emails.id
      DYNAMODB_TABLE = aws_dynamodb_table.known_ai_senders.name
      
      # Gmail OAuth Configuration - from .env.aws
      GMAIL_CLIENT_ID     = var.gmail_client_id
      GMAIL_CLIENT_SECRET = var.gmail_client_secret
      GMAIL_REFRESH_TOKEN = var.gmail_refresh_token
      
      # OpenAI Configuration
      OPENAI_API_KEY    = var.openai_api_key
      HELICONE_API_KEY  = var.helicone_api_key
      
      # Email Configuration
      RESEND_API_KEY    = var.resend_api_key
      RECIPIENT_EMAIL   = var.recipient_email
      
      # Processing Configuration
      OLDER_THAN_DAYS       = var.older_than_days
      MAX_LINKS_PER_EMAIL   = var.max_links_per_email
      MAX_SECTIONS          = var.max_sections
      KEYWORDS              = var.keywords
      PROFESSIONS           = var.professions
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.weekly_digest
  ]
}

# Lambda function for run-now
resource "aws_lambda_function" "run_now" {
  function_name = "${var.project_name}-run-now"
  role          = aws_iam_role.lambda_role.arn
  handler       = "run-now.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.lambda_package.key

  environment {
    variables = {
      WEEKLY_DIGEST_FUNCTION_NAME = aws_lambda_function.weekly_digest.function_name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.run_now
  ]
}

# Comment out invoke policy as user doesn't have IAM permissions
# The existing role should already have necessary permissions

# EventBridge rule for weekly schedule
resource "aws_cloudwatch_event_rule" "weekly_schedule" {
  name                = "${var.project_name}-weekly-schedule"
  description         = "Trigger weekly digest every Sunday at 8 AM UTC"
  schedule_expression = "cron(0 8 ? * SUN *)"
}

resource "aws_cloudwatch_event_target" "weekly_digest" {
  rule      = aws_cloudwatch_event_rule.weekly_schedule.name
  target_id = "WeeklyDigestTarget"
  arn       = aws_lambda_function.weekly_digest.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.weekly_digest.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_schedule.arn
}

# API Gateway for HTTP triggers
resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.project_name}-api"
  description = "API Gateway for AI Digest functions"
}

resource "aws_api_gateway_resource" "run" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "run"
}

resource "aws_api_gateway_method" "run_post" {
  rest_api_id      = aws_api_gateway_rest_api.api.id
  resource_id      = aws_api_gateway_resource.run.id
  http_method      = "POST"
  authorization    = "NONE"
  api_key_required = true
}

resource "aws_api_gateway_integration" "run_lambda" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.run.id
  http_method = aws_api_gateway_method.run_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.run_now.invoke_arn
}

resource "aws_lambda_permission" "api_gateway_run" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.run_now.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  depends_on = [
    aws_api_gateway_integration.run_lambda
  ]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = "prod"
}

resource "aws_api_gateway_api_key" "api_key" {
  name = "${var.project_name}-api-key"
}

resource "aws_api_gateway_usage_plan" "main" {
  name = "${var.project_name}-usage-plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.api.id
    stage  = aws_api_gateway_stage.prod.stage_name
  }

  throttle_settings {
    rate_limit  = 10
    burst_limit = 20
  }

  quota_settings {
    limit  = 1000
    period = "MONTH"
  }
}

resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.api_key.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.main.id
}

# Outputs
output "api_gateway_url" {
  value       = "https://${aws_api_gateway_rest_api.api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/prod"
  description = "API Gateway URL"
}

output "api_key_id" {
  value       = aws_api_gateway_api_key.api_key.id
  description = "API Key ID (use AWS CLI to get the actual key value)"
}

output "weekly_digest_function_name" {
  value       = aws_lambda_function.weekly_digest.function_name
  description = "Weekly Digest Lambda function name"
}

output "run_now_function_name" {
  value       = aws_lambda_function.run_now.function_name
  description = "Run Now Lambda function name"
}

output "processed_emails_bucket" {
  value       = aws_s3_bucket.processed_emails.id
  description = "S3 bucket for processed emails"
}

output "known_ai_senders_table" {
  value       = aws_dynamodb_table.known_ai_senders.name
  description = "DynamoDB table for known AI senders"
}