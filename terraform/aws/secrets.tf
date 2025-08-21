# AWS Secrets Manager for API Keys
resource "aws_secretsmanager_secret" "api_keys" {
  name                    = "${var.PROJECT_NAME}-api-keys"
  description            = "API keys for AI Digest application"
  recovery_window_in_days = 7

  tags = {
    Name        = "${var.PROJECT_NAME}-api-keys"
    Environment = var.environment
    Project     = var.PROJECT_NAME
  }
}

# Secret values (will be set manually via AWS Console or CLI)
resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  
  # IMPORTANT: These values should be set from variables for initial creation
  # After creation, they can be rotated via AWS Console or CLI
  secret_string = jsonencode({
    gmail_client_id     = var.GMAIL_CLIENT_ID
    gmail_client_secret = var.GMAIL_CLIENT_SECRET
    gmail_refresh_token = var.GMAIL_REFRESH_TOKEN
    openai_api_key      = var.OPENAI_API_KEY
    helicone_api_key    = var.HELICONE_API_KEY
    resend_api_key      = var.RESEND_API_KEY
    resend_from         = var.RECIPIENT_EMAIL
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# IAM Policy for Lambda to access secrets
resource "aws_iam_policy" "secrets_access" {
  name        = "${var.PROJECT_NAME}-secrets-access"
  description = "Allow Lambda functions to access Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.api_keys.arn
      }
    ]
  })
}

# Attach secrets access policy to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_secrets_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# Output the secret ARN for reference
output "secrets_arn" {
  value       = aws_secretsmanager_secret.api_keys.arn
  description = "ARN of the Secrets Manager secret containing API keys"
}