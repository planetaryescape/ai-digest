# =====================================================================
# AI DIGEST PIPELINE INFRASTRUCTURE
# =====================================================================
# This module defines the SQS-based pipeline architecture for processing
# emails through multiple Lambda functions in sequence
# =====================================================================

# ========================================
# SQS QUEUES AND DEAD LETTER QUEUES
# ========================================

# Dead Letter Queue for emails-to-classify
resource "aws_sqs_queue" "emails_to_classify_dlq" {
  name                      = "${var.PROJECT_NAME}-emails-to-classify-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "DLQ"
    ManagedBy   = "Terraform"
  }
}

# Queue: Email Fetcher -> Classifier
resource "aws_sqs_queue" "emails_to_classify" {
  name                       = "${var.PROJECT_NAME}-emails-to-classify"
  visibility_timeout_seconds = 180  # 3x Lambda timeout
  message_retention_seconds  = 86400  # 1 day
  delay_seconds             = 0
  receive_wait_time_seconds = 20  # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.emails_to_classify_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Stage       = "classification"
    ManagedBy   = "Terraform"
  }
}

# Dead Letter Queue for emails-to-extract
resource "aws_sqs_queue" "emails_to_extract_dlq" {
  name                      = "${var.PROJECT_NAME}-emails-to-extract-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "DLQ"
    ManagedBy   = "Terraform"
  }
}

# Queue: Classifier -> Content Extractor
resource "aws_sqs_queue" "emails_to_extract" {
  name                       = "${var.PROJECT_NAME}-emails-to-extract"
  visibility_timeout_seconds = 270  # 3x Lambda timeout (90s)
  message_retention_seconds  = 86400  # 1 day
  delay_seconds             = 0
  receive_wait_time_seconds = 20  # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.emails_to_extract_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Stage       = "extraction"
    ManagedBy   = "Terraform"
  }
}

# Dead Letter Queue for emails-to-research
resource "aws_sqs_queue" "emails_to_research_dlq" {
  name                      = "${var.PROJECT_NAME}-emails-to-research-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "DLQ"
    ManagedBy   = "Terraform"
  }
}

# Queue: Content Extractor -> Research
resource "aws_sqs_queue" "emails_to_research" {
  name                       = "${var.PROJECT_NAME}-emails-to-research"
  visibility_timeout_seconds = 180  # 3x Lambda timeout (60s)
  message_retention_seconds  = 86400  # 1 day
  delay_seconds             = 0
  receive_wait_time_seconds = 20  # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.emails_to_research_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Stage       = "research"
    ManagedBy   = "Terraform"
  }
}

# Dead Letter Queue for emails-to-analyze
resource "aws_sqs_queue" "emails_to_analyze_dlq" {
  name                      = "${var.PROJECT_NAME}-emails-to-analyze-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "DLQ"
    ManagedBy   = "Terraform"
  }
}

# Queue: Research -> Analysis
resource "aws_sqs_queue" "emails_to_analyze" {
  name                       = "${var.PROJECT_NAME}-emails-to-analyze"
  visibility_timeout_seconds = 360  # 3x Lambda timeout (120s)
  message_retention_seconds  = 86400  # 1 day
  delay_seconds             = 0
  receive_wait_time_seconds = 20  # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.emails_to_analyze_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Stage       = "analysis"
    ManagedBy   = "Terraform"
  }
}

# Dead Letter Queue for analysis-to-critique
resource "aws_sqs_queue" "analysis_to_critique_dlq" {
  name                      = "${var.PROJECT_NAME}-analysis-to-critique-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "DLQ"
    ManagedBy   = "Terraform"
  }
}

# Queue: Analysis -> Critic
resource "aws_sqs_queue" "analysis_to_critique" {
  name                       = "${var.PROJECT_NAME}-analysis-to-critique"
  visibility_timeout_seconds = 180  # 3x Lambda timeout (60s)
  message_retention_seconds  = 86400  # 1 day
  delay_seconds             = 0
  receive_wait_time_seconds = 20  # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.analysis_to_critique_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Stage       = "critique"
    ManagedBy   = "Terraform"
  }
}

# Dead Letter Queue for digest-to-send
resource "aws_sqs_queue" "digest_to_send_dlq" {
  name                      = "${var.PROJECT_NAME}-digest-to-send-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "DLQ"
    ManagedBy   = "Terraform"
  }
}

# Queue: Critic -> Digest Sender
resource "aws_sqs_queue" "digest_to_send" {
  name                       = "${var.PROJECT_NAME}-digest-to-send"
  visibility_timeout_seconds = 90  # 3x Lambda timeout (30s)
  message_retention_seconds  = 86400  # 1 day
  delay_seconds             = 0
  receive_wait_time_seconds = 20  # Long polling
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.digest_to_send_dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Stage       = "send"
    ManagedBy   = "Terraform"
  }
}

# ========================================
# DYNAMODB TABLE FOR PIPELINE STATE
# ========================================

resource "aws_dynamodb_table" "pipeline_state" {
  name           = "${var.PROJECT_NAME}-pipeline-state"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "correlationId"
  range_key      = "stateType"
  
  attribute {
    name = "correlationId"
    type = "S"
  }
  
  attribute {
    name = "stateType"
    type = "S"
  }
  
  attribute {
    name = "batchId"
    type = "S"
  }
  
  # TTL for automatic cleanup
  # Temporarily commented out due to AWS rate limiting
  # ttl {
  #   attribute_name = "expiresAt"
  #   enabled        = true
  # }
  
  # Global secondary index for batch queries
  global_secondary_index {
    name            = "BatchIndex"
    hash_key        = "batchId"
    range_key       = "stateType"
    projection_type = "ALL"
  }
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Purpose     = "Pipeline state management"
    ManagedBy   = "Terraform"
  }
}

# ========================================
# S3 BUCKET FOR PIPELINE DATA
# ========================================

resource "aws_s3_bucket" "pipeline_data" {
  bucket = "${var.PROJECT_NAME}-pipeline-data-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}"
  
  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Purpose     = "Large message payloads"
    ManagedBy   = "Terraform"
  }
}

# Versioning for pipeline data bucket
resource "aws_s3_bucket_versioning" "pipeline_data" {
  bucket = aws_s3_bucket.pipeline_data.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle policy to clean up old data
resource "aws_s3_bucket_lifecycle_configuration" "pipeline_data" {
  bucket = aws_s3_bucket.pipeline_data.id
  
  rule {
    id     = "cleanup-old-data"
    status = "Enabled"
    
    filter {} # Empty filter applies to all objects
    
    expiration {
      days = 7
    }
    
    noncurrent_version_expiration {
      noncurrent_days = 3
    }
  }
}

# Encryption for pipeline data
resource "aws_s3_bucket_server_side_encryption_configuration" "pipeline_data" {
  bucket = aws_s3_bucket.pipeline_data.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ========================================
# IAM POLICIES FOR PIPELINE ACCESS
# ========================================

# Policy for SQS access
resource "aws_iam_policy" "pipeline_sqs_access" {
  name = "${var.PROJECT_NAME}-pipeline-sqs-access"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.emails_to_classify.arn,
          aws_sqs_queue.emails_to_extract.arn,
          aws_sqs_queue.emails_to_research.arn,
          aws_sqs_queue.emails_to_analyze.arn,
          aws_sqs_queue.analysis_to_critique.arn,
          aws_sqs_queue.digest_to_send.arn,
          aws_sqs_queue.emails_to_classify_dlq.arn,
          aws_sqs_queue.emails_to_extract_dlq.arn,
          aws_sqs_queue.emails_to_research_dlq.arn,
          aws_sqs_queue.emails_to_analyze_dlq.arn,
          aws_sqs_queue.analysis_to_critique_dlq.arn,
          aws_sqs_queue.digest_to_send_dlq.arn
        ]
      }
    ]
  })
}

# Policy for pipeline state DynamoDB access
resource "aws_iam_policy" "pipeline_state_access" {
  name = "${var.PROJECT_NAME}-pipeline-state-access"
  
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
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.pipeline_state.arn,
          "${aws_dynamodb_table.pipeline_state.arn}/index/*"
        ]
      }
    ]
  })
}

# Policy for pipeline data S3 access
resource "aws_iam_policy" "pipeline_data_access" {
  name = "${var.PROJECT_NAME}-pipeline-data-access"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.pipeline_data.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.pipeline_data.arn
      }
    ]
  })
}

# Attach policies to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_pipeline_sqs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.pipeline_sqs_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_pipeline_state" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.pipeline_state_access.arn
}

resource "aws_iam_role_policy_attachment" "lambda_pipeline_data" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.pipeline_data_access.arn
}

# ========================================
# OUTPUTS FOR REFERENCE
# ========================================

output "sqs_queues" {
  value = {
    emails_to_classify    = aws_sqs_queue.emails_to_classify.url
    emails_to_extract     = aws_sqs_queue.emails_to_extract.url
    emails_to_research    = aws_sqs_queue.emails_to_research.url
    emails_to_analyze     = aws_sqs_queue.emails_to_analyze.url
    analysis_to_critique  = aws_sqs_queue.analysis_to_critique.url
    digest_to_send        = aws_sqs_queue.digest_to_send.url
  }
  
  description = "URLs of all pipeline SQS queues"
}

output "pipeline_state_table" {
  value = aws_dynamodb_table.pipeline_state.name
  description = "Name of the pipeline state DynamoDB table"
}

output "pipeline_data_bucket" {
  value = aws_s3_bucket.pipeline_data.id
  description = "Name of the pipeline data S3 bucket"
}