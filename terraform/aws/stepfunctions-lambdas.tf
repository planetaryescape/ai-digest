# =====================================================================
# STEP FUNCTIONS LAMBDA FUNCTIONS
# =====================================================================
# Lambda functions refactored for Step Functions integration
# Simplified handlers without queue/state management
# =====================================================================

# ========================================
# S3 DEPLOYMENT PACKAGE
# ========================================

resource "aws_s3_object" "sf_lambda_package" {
  bucket = aws_s3_bucket.lambda_deployments.id
  key    = "lambda-stepfunctions-${formatdate("YYYY-MM-DD'T'hhmm", timestamp())}.zip"
  source = "${path.module}/../../terraform/artifacts/lambda-stepfunctions.zip"
  etag   = filemd5("${path.module}/../../terraform/artifacts/lambda-stepfunctions.zip")
}

# ========================================
# CLOUDWATCH LOG GROUPS
# ========================================

resource "aws_cloudwatch_log_group" "sf_email_fetcher" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-email-fetcher"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_classifier" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-classifier"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_content_extractor" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-content-extractor"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_research" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-research"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_analysis" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-analysis"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_critic" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-critic"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_digest_sender" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-digest-sender"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "sf_error_handler" {
  name              = "/aws/lambda/${var.PROJECT_NAME}-sf-error-handler"
  retention_in_days = 7
}

# ========================================
# LAMBDA FUNCTIONS
# ========================================

# Email Fetcher Lambda
resource "aws_lambda_function" "sf_email_fetcher" {
  function_name = "${var.PROJECT_NAME}-sf-email-fetcher"
  role          = aws_iam_role.lambda_role.arn
  handler       = "email-fetcher.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      SECRET_ARN           = aws_secretsmanager_secret.api_keys.arn
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      KNOWN_AI_TABLE       = aws_dynamodb_table.known_ai_senders.name
      KNOWN_NON_AI_TABLE   = aws_dynamodb_table.known_non_ai_senders.name
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_email_fetcher
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "fetch"
  }
}

# Classifier Lambda
resource "aws_lambda_function" "sf_classifier" {
  function_name = "${var.PROJECT_NAME}-sf-classifier"
  role          = aws_iam_role.lambda_role.arn
  handler       = "classifier.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes  # 5 minutes for classification
  memory_size   = 512

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      SECRET_ARN           = aws_secretsmanager_secret.api_keys.arn
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      KNOWN_AI_TABLE       = aws_dynamodb_table.known_ai_senders.name
      KNOWN_NON_AI_TABLE   = aws_dynamodb_table.known_non_ai_senders.name
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_classifier
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "classify"
  }
}

# Content Extractor Lambda
resource "aws_lambda_function" "sf_content_extractor" {
  function_name = "${var.PROJECT_NAME}-sf-content-extractor"
  role          = aws_iam_role.lambda_role.arn
  handler       = "content-extractor.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes  # 5 minutes for content extraction
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      FIRECRAWL_API_KEY    = var.FIRECRAWL_API_KEY
      ENABLE_FIRECRAWL     = var.ENABLE_FIRECRAWL
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      MAX_URLS_PER_EMAIL   = var.max_links_per_email
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_content_extractor
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "extract"
  }
}

# Research Lambda
resource "aws_lambda_function" "sf_research" {
  function_name = "${var.PROJECT_NAME}-sf-research"
  role          = aws_iam_role.lambda_role.arn
  handler       = "research.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes
  memory_size   = 512

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      BRAVE_API_KEY        = var.BRAVE_API_KEY
      ENABLE_RESEARCH      = var.ENABLE_RESEARCH
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_research
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "research"
  }
}

# Analysis Lambda
resource "aws_lambda_function" "sf_analysis" {
  function_name = "${var.PROJECT_NAME}-sf-analysis"
  role          = aws_iam_role.lambda_role.arn
  handler       = "analysis.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      SECRET_ARN           = aws_secretsmanager_secret.api_keys.arn
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      ANALYSIS_MODEL       = var.ANALYSIS_MODEL
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_analysis
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "analyze"
  }
}

# Critic Lambda
resource "aws_lambda_function" "sf_critic" {
  function_name = "${var.PROJECT_NAME}-sf-critic"
  role          = aws_iam_role.lambda_role.arn
  handler       = "critic.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      SECRET_ARN           = aws_secretsmanager_secret.api_keys.arn
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      ENABLE_CRITIC_AGENT  = var.ENABLE_CRITIC_AGENT
      ANALYSIS_MODEL       = var.ANALYSIS_MODEL
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_critic
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "critique"
  }
}

# Digest Sender Lambda
resource "aws_lambda_function" "sf_digest_sender" {
  function_name = "${var.PROJECT_NAME}-sf-digest-sender"
  role          = aws_iam_role.lambda_role.arn
  handler       = "digest-sender.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      SECRET_ARN                  = aws_secretsmanager_secret.api_keys.arn
      RECIPIENT_EMAIL             = var.RECIPIENT_EMAIL
      PIPELINE_DATA_BUCKET        = aws_s3_bucket.pipeline_data.id
      ARCHIVE_AFTER_PROCESSING    = var.ARCHIVE_AFTER_PROCESSING
      NODE_ENV                    = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_digest_sender
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "send"
  }
}

# Error Handler Lambda
resource "aws_lambda_function" "sf_error_handler" {
  function_name = "${var.PROJECT_NAME}-sf-error-handler"
  role          = aws_iam_role.lambda_role.arn
  handler       = "error-handler.lambdaHandler"
  runtime       = "nodejs20.x"
  timeout       = 900  # 15 minutes
  memory_size   = 256

  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = aws_s3_object.sf_lambda_package.key

  environment {
    variables = {
      SECRET_ARN           = aws_secretsmanager_secret.api_keys.arn
      RECIPIENT_EMAIL      = var.RECIPIENT_EMAIL
      PIPELINE_DATA_BUCKET = aws_s3_bucket.pipeline_data.id
      NODE_ENV             = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.sf_error_handler
  ]

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "StepFunctions"
    Stage       = "error"
  }
}

# ========================================
# LAMBDA PERMISSIONS FOR STEP FUNCTIONS
# ========================================

resource "aws_lambda_permission" "sf_email_fetcher_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_email_fetcher.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_classifier_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_classifier.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_content_extractor_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_content_extractor.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_research_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_research.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_analysis_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_analysis.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_critic_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_critic.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_digest_sender_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_digest_sender.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

resource "aws_lambda_permission" "sf_error_handler_invoke" {
  statement_id  = "AllowStepFunctionsInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sf_error_handler.function_name
  principal     = "states.amazonaws.com"
  source_arn    = "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline"
}

# ========================================
# OUTPUTS
# ========================================

output "sf_lambda_functions" {
  value = {
    email_fetcher     = aws_lambda_function.sf_email_fetcher.function_name
    classifier        = aws_lambda_function.sf_classifier.function_name
    content_extractor = aws_lambda_function.sf_content_extractor.function_name
    research          = aws_lambda_function.sf_research.function_name
    analysis          = aws_lambda_function.sf_analysis.function_name
    critic            = aws_lambda_function.sf_critic.function_name
    digest_sender     = aws_lambda_function.sf_digest_sender.function_name
    error_handler     = aws_lambda_function.sf_error_handler.function_name
  }
  description = "Step Functions Lambda function names"
}