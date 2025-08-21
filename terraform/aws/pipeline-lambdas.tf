# =====================================================================
# PIPELINE LAMBDA FUNCTIONS
# =====================================================================
# This file defines all Lambda functions for the pipeline architecture
# =====================================================================

# ========================================
# CLOUDWATCH LOG GROUPS
# ========================================

resource "aws_cloudwatch_log_group" "email_fetcher" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-email-fetcher"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "classifier" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-classifier"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "content_extractor" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-content-extractor"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "research" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-research"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "analysis" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-analysis"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "critic" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-critic"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "digest_sender" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-digest-sender"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "orchestrator" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-orchestrator"
  retention_in_days = 7
}

# ========================================
# LAMBDA PACKAGE
# ========================================

# Package for pipeline Lambda functions
resource "aws_s3_object" "pipeline_lambda_package" {
  bucket = aws_s3_bucket.lambda_deployments.id
  key    = "lambda-pipeline-${timestamp()}.zip"
  source = "${path.module}/../../terraform/artifacts/lambda-pipeline.zip"
  etag   = filemd5("${path.module}/../../terraform/artifacts/lambda-pipeline.zip")
}

# ========================================
# LAMBDA FUNCTIONS
# ========================================

# Email Fetcher Lambda
resource "aws_lambda_function" "email_fetcher" {
  function_name = "${var.PROJECT_NAME}-email-fetcher"
  role          = aws_iam_role.lambda_role.arn
  handler       = "email-fetcher.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # Gmail OAuth Configuration
      GMAIL_CLIENT_ID     = var.GMAIL_CLIENT_ID
      GMAIL_CLIENT_SECRET = var.GMAIL_CLIENT_SECRET
      GMAIL_REFRESH_TOKEN = var.GMAIL_REFRESH_TOKEN
      
      # Queue URLs
      SQS_EMAILS_TO_CLASSIFY = aws_sqs_queue.emails_to_classify.url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.email_fetcher
  ]
}

# Classifier Lambda
resource "aws_lambda_function" "classifier" {
  function_name = "${var.PROJECT_NAME}-classifier"
  role          = aws_iam_role.lambda_role.arn
  handler       = "classifier.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # OpenAI Configuration
      OPENAI_API_KEY    = var.OPENAI_API_KEY
      HELICONE_API_KEY  = var.HELICONE_API_KEY
      
      # Queue URLs
      SQS_EMAILS_TO_EXTRACT = aws_sqs_queue.emails_to_extract.url
      
      # Storage for known senders
      DYNAMODB_TABLE = aws_dynamodb_table.known_ai_senders.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.classifier
  ]
}

# Content Extractor Lambda
resource "aws_lambda_function" "content_extractor" {
  function_name = "${var.PROJECT_NAME}-content-extractor"
  role          = aws_iam_role.lambda_role.arn
  handler       = "content-extractor.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 512

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # Firecrawl Configuration (optional)
      FIRECRAWL_API_KEY = var.FIRECRAWL_API_KEY
      ENABLE_FIRECRAWL  = var.ENABLE_FIRECRAWL
      
      # Queue URLs
      SQS_EMAILS_TO_RESEARCH = aws_sqs_queue.emails_to_research.url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.content_extractor
  ]
}

# Research Lambda
resource "aws_lambda_function" "research" {
  function_name = "${var.PROJECT_NAME}-research"
  role          = aws_iam_role.lambda_role.arn
  handler       = "research.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # Brave Search Configuration (optional)
      BRAVE_API_KEY    = var.BRAVE_API_KEY
      ENABLE_RESEARCH  = var.ENABLE_RESEARCH
      
      # Queue URLs
      SQS_EMAILS_TO_ANALYZE = aws_sqs_queue.emails_to_analyze.url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.research
  ]
}

# Analysis Lambda
resource "aws_lambda_function" "analysis" {
  function_name = "${var.PROJECT_NAME}-analysis"
  role          = aws_iam_role.lambda_role.arn
  handler       = "analysis.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # OpenAI Configuration
      OPENAI_API_KEY    = var.OPENAI_API_KEY
      HELICONE_API_KEY  = var.HELICONE_API_KEY
      
      # Queue URLs
      SQS_ANALYSIS_TO_CRITIQUE = aws_sqs_queue.analysis_to_critique.url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.analysis
  ]
}

# Critic Lambda
resource "aws_lambda_function" "critic" {
  function_name = "${var.PROJECT_NAME}-critic"
  role          = aws_iam_role.lambda_role.arn
  handler       = "critic.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # OpenAI Configuration
      OPENAI_API_KEY    = var.OPENAI_API_KEY
      HELICONE_API_KEY  = var.HELICONE_API_KEY
      
      # Queue URLs
      SQS_DIGEST_TO_SEND = aws_sqs_queue.digest_to_send.url
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.critic
  ]
}

# Digest Sender Lambda
resource "aws_lambda_function" "digest_sender" {
  function_name = "${var.PROJECT_NAME}-digest-sender"
  role          = aws_iam_role.lambda_role.arn
  handler       = "digest-sender.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # Email Configuration
      RESEND_API_KEY   = var.RESEND_API_KEY
      RECIPIENT_EMAIL  = var.RECIPIENT_EMAIL
      
      # Gmail Configuration (for archiving)
      GMAIL_CLIENT_ID     = var.GMAIL_CLIENT_ID
      GMAIL_CLIENT_SECRET = var.GMAIL_CLIENT_SECRET
      GMAIL_REFRESH_TOKEN = var.GMAIL_REFRESH_TOKEN
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.digest_sender
  ]
}

# Orchestrator Lambda
resource "aws_lambda_function" "orchestrator" {
  function_name = "${var.PROJECT_NAME}-orchestrator"
  role          = aws_iam_role.lambda_role.arn
  handler       = "orchestrator.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 512

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.pipeline_lambda_package.key

  environment {
    variables = {
      # Pipeline configuration
      PIPELINE_STATE_TABLE = aws_dynamodb_table.pipeline_state.name
      PROJECT_NAME         = var.PROJECT_NAME
      AWS_ACCOUNT_ID       = data.aws_caller_identity.current.account_id
      
      # Lambda function names
      EMAIL_FETCHER_FUNCTION_NAME = aws_lambda_function.email_fetcher.function_name
      
      # Email Configuration (for error notifications)
      RESEND_API_KEY   = var.RESEND_API_KEY
      RECIPIENT_EMAIL  = var.RECIPIENT_EMAIL
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.orchestrator
  ]
}

# ========================================
# SQS EVENT SOURCE MAPPINGS
# ========================================

# Classifier triggered by emails-to-classify queue
resource "aws_lambda_event_source_mapping" "classifier_sqs" {
  event_source_arn = aws_sqs_queue.emails_to_classify.arn
  function_name    = aws_lambda_function.classifier.arn
  batch_size       = 1
  enabled          = true
}

# Content Extractor triggered by emails-to-extract queue
resource "aws_lambda_event_source_mapping" "content_extractor_sqs" {
  event_source_arn = aws_sqs_queue.emails_to_extract.arn
  function_name    = aws_lambda_function.content_extractor.arn
  batch_size       = 1
  enabled          = true
}

# Research triggered by emails-to-research queue
resource "aws_lambda_event_source_mapping" "research_sqs" {
  event_source_arn = aws_sqs_queue.emails_to_research.arn
  function_name    = aws_lambda_function.research.arn
  batch_size       = 1
  enabled          = true
}

# Analysis triggered by emails-to-analyze queue
resource "aws_lambda_event_source_mapping" "analysis_sqs" {
  event_source_arn = aws_sqs_queue.emails_to_analyze.arn
  function_name    = aws_lambda_function.analysis.arn
  batch_size       = 1
  enabled          = true
}

# Critic triggered by analysis-to-critique queue
resource "aws_lambda_event_source_mapping" "critic_sqs" {
  event_source_arn = aws_sqs_queue.analysis_to_critique.arn
  function_name    = aws_lambda_function.critic.arn
  batch_size       = 1
  enabled          = true
}

# Digest Sender triggered by digest-to-send queue
resource "aws_lambda_event_source_mapping" "digest_sender_sqs" {
  event_source_arn = aws_sqs_queue.digest_to_send.arn
  function_name    = aws_lambda_function.digest_sender.arn
  batch_size       = 1
  enabled          = true
}

# ========================================
# LAMBDA PERMISSIONS FOR INVOCATION
# ========================================

# Allow orchestrator to invoke email fetcher
resource "aws_iam_policy" "orchestrator_invoke" {
  name = "${var.PROJECT_NAME}-orchestrator-invoke"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.email_fetcher.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "orchestrator_invoke" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.orchestrator_invoke.arn
}

# ========================================
# EVENTBRIDGE RULES FOR SCHEDULING
# ========================================

# Weekly digest schedule for pipeline (Sundays at 10 AM UTC)
resource "aws_cloudwatch_event_rule" "pipeline_weekly_digest" {
  name                = "${var.PROJECT_NAME}-pipeline-weekly-schedule"
  description         = "Trigger weekly digest pipeline"
  schedule_expression = "cron(0 10 ? * SUN *)"
  is_enabled          = var.enable_weekly_schedule
}

resource "aws_cloudwatch_event_target" "pipeline_weekly_digest" {
  rule      = aws_cloudwatch_event_rule.pipeline_weekly_digest.name
  target_id = "orchestrator"
  arn       = aws_lambda_function.orchestrator.arn
  
  input = jsonencode({
    action = "start"
    mode   = "weekly"
  })
}

resource "aws_lambda_permission" "allow_eventbridge_pipeline_weekly" {
  statement_id  = "AllowPipelineExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.orchestrator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.pipeline_weekly_digest.arn
}

# Lambda Function URL for manual triggering
resource "aws_lambda_function_url" "orchestrator" {
  function_name      = aws_lambda_function.orchestrator.function_name
  authorization_type = "NONE"
  
  cors {
    allow_credentials = true
    allow_origins     = var.allowed_origins
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age           = 86400
  }
}

# ========================================
# OUTPUTS
# ========================================

output "pipeline_lambdas" {
  value = {
    email_fetcher      = aws_lambda_function.email_fetcher.function_name
    classifier         = aws_lambda_function.classifier.function_name
    content_extractor  = aws_lambda_function.content_extractor.function_name
    research           = aws_lambda_function.research.function_name
    analysis           = aws_lambda_function.analysis.function_name
    critic             = aws_lambda_function.critic.function_name
    digest_sender      = aws_lambda_function.digest_sender.function_name
    orchestrator       = aws_lambda_function.orchestrator.function_name
  }
  
  description = "Names of all pipeline Lambda functions"
}

output "orchestrator_url" {
  value = aws_lambda_function_url.orchestrator.function_url
  description = "URL to trigger the pipeline orchestrator"
}