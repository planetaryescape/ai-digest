# AWS Secrets Manager configuration for AI Digest

# Create the secret
resource "aws_secretsmanager_secret" "ai_digest_secrets" {
  name                    = "${var.PROJECT_NAME}-api-keys"
  description             = "API keys and credentials for AI Digest application"
  recovery_window_in_days = 7

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Store the secret values
resource "aws_secretsmanager_secret_version" "ai_digest_secrets" {
  secret_id = aws_secretsmanager_secret.ai_digest_secrets.id
  
  secret_string = jsonencode({
    gmail_client_id      = var.GMAIL_CLIENT_ID
    gmail_client_secret  = var.GMAIL_CLIENT_SECRET
    gmail_refresh_token  = var.GMAIL_REFRESH_TOKEN
    openai_api_key       = var.OPENAI_API_KEY
    helicone_api_key     = var.HELICONE_API_KEY
    resend_api_key       = var.RESEND_API_KEY
    resend_from          = var.RECIPIENT_EMAIL
    firecrawl_api_key    = var.FIRECRAWL_API_KEY
    brave_search_api_key = var.BRAVE_API_KEY
  })
}

# IAM policy for Lambda functions to access the secret
resource "aws_iam_policy" "secrets_manager_access" {
  name        = "${var.PROJECT_NAME}-secrets-manager-access"
  description = "Policy to allow Lambda functions to read secrets from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.ai_digest_secrets.arn
      }
    ]
  })
}

# Attach the policy to the Lambda role
resource "aws_iam_role_policy_attachment" "lambda_secrets_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.secrets_manager_access.arn
}

# Output the secret ARN for use in Lambda environment variables
output "secrets_arn" {
  value       = aws_secretsmanager_secret.ai_digest_secrets.arn
  description = "ARN of the Secrets Manager secret containing API keys"
}