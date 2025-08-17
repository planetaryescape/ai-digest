# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# S3 Bucket for Lambda deployment packages
resource "aws_s3_bucket" "lambda_deployments" {
  bucket = "${var.project_name}-lambda-deployments-${data.aws_caller_identity.current.account_id}"
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

# DynamoDB Table for processed emails
resource "aws_dynamodb_table" "processed_emails" {
  name         = "${var.project_name}-processed-emails"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "partitionKey"
  range_key    = "rowKey"

  attribute {
    name = "partitionKey"
    type = "S"
  }

  attribute {
    name = "rowKey"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-processed-emails"
  }
}

# Secrets Manager for sensitive data
resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${var.project_name}-secrets"
  description = "Secrets for AI Digest application"
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    gmail_client_id     = ""
    gmail_client_secret = ""
    gmail_refresh_token = ""
    openai_api_key      = ""
    helicone_api_key    = ""
    resend_api_key      = ""
    resend_from         = "AI Digest <digest@yourdomain.com>"
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# IAM Role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for Lambda functions
resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.project_name}-lambda-policy"
  description = "Policy for AI Digest Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.processed_emails.arn
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:${var.project_name}-*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
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

# Lambda function packages (to be uploaded)
resource "aws_s3_object" "lambda_package" {
  bucket = aws_s3_bucket.lambda_deployments.id
  key    = "package-${filemd5("${path.module}/../artifacts/package.zip")}.zip"
  source = "${path.module}/../artifacts/package.zip"
  etag   = filemd5("${path.module}/../artifacts/package.zip")
}

# Lambda function for weekly digest
resource "aws_lambda_function" "weekly_digest" {
  function_name = "${var.project_name}-weekly-digest"
  role          = aws_iam_role.lambda_role.arn
  handler       = "weekly-digest.handler"
  runtime       = "nodejs20.x"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.lambda_package.key

  environment {
    variables = {
      NODE_ENV                  = var.environment
      DYNAMODB_TABLE_NAME       = aws_dynamodb_table.processed_emails.name
      SECRET_ARN                = aws_secretsmanager_secret.app_secrets.arn
      RECIPIENT_EMAIL           = var.recipient_email
      OLDER_THAN_DAYS           = var.older_than_days
      MAX_LINKS_PER_EMAIL       = var.max_links_per_email
      MAX_SECTIONS              = var.max_sections
      OPENAI_MODEL              = var.openai_model
      KEYWORDS                  = var.keywords
      PROFESSIONS               = var.professions
      PRODUCT_CONTEXT           = jsonencode({
        owner = "Bhekani"
        apps = [
          {
            name = "Interview Optimiser"
            url  = "https://interviewoptimiser.com"
            desc = "Mock interviews & coaching"
          },
          {
            name = "CV Optimiser"
            url  = "https://cvoptimiser.com"
            desc = "AI CV optimization"
          },
          {
            name = "Reference Optimiser"
            url  = "https://referenceoptimiser.com"
            desc = "Reference letter generation"
          },
          {
            name = "Dealbase"
            url  = "https://dealbase.com"
            desc = "Startup funding database"
          },
          {
            name = "Blog"
            url  = "https://bhekani.com"
            desc = "Technical & indie content"
          }
        ]
      })
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.weekly_digest
  ]
}

# Lambda function for manual trigger
resource "aws_lambda_function" "run_now" {
  function_name = "${var.project_name}-run-now"
  role          = aws_iam_role.lambda_role.arn
  handler       = "run-now.handler"
  runtime       = "nodejs20.x"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.lambda_package.key

  environment {
    variables = {
      NODE_ENV            = var.environment
      WEEKLY_DIGEST_ARN   = aws_lambda_function.weekly_digest.arn
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.run_now
  ]
}

# EventBridge rule for scheduled execution
resource "aws_cloudwatch_event_rule" "weekly_schedule" {
  name                = "${var.project_name}-weekly-schedule"
  description         = "Trigger weekly digest every Sunday at 8 AM"
  schedule_expression = var.schedule_expression
}

resource "aws_cloudwatch_event_target" "weekly_digest" {
  rule      = aws_cloudwatch_event_rule.weekly_schedule.name
  target_id = "weekly-digest-lambda"
  arn       = aws_lambda_function.weekly_digest.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.weekly_digest.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_schedule.arn
}

# API Gateway for HTTP trigger
resource "aws_api_gateway_rest_api" "api" {
  name        = "${var.project_name}-api"
  description = "API for AI Digest manual trigger"
}

resource "aws_api_gateway_resource" "run" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "run"
}

resource "aws_api_gateway_method" "run_post" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.run.id
  http_method   = "POST"
  authorization = "NONE"
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

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.run_now.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "api" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  stage_name  = var.environment

  depends_on = [
    aws_api_gateway_integration.run_lambda
  ]
}

# API Key for authentication
resource "aws_api_gateway_api_key" "api_key" {
  name = "${var.project_name}-api-key"
}

resource "aws_api_gateway_usage_plan" "usage_plan" {
  name = "${var.project_name}-usage-plan"

  api_stages {
    api_id = aws_api_gateway_rest_api.api.id
    stage  = aws_api_gateway_deployment.api.stage_name
  }
}

resource "aws_api_gateway_usage_plan_key" "usage_plan_key" {
  key_id        = aws_api_gateway_api_key.api_key.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.usage_plan.id
}