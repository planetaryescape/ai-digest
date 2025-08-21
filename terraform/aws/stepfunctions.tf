# =====================================================================
# STEP FUNCTIONS INFRASTRUCTURE
# =====================================================================
# Migrated from SQS-based pipeline to Step Functions for better
# orchestration, error handling, and observability
# =====================================================================

# ========================================
# IAM ROLE FOR STEP FUNCTIONS
# ========================================

resource "aws_iam_role" "step_functions_role" {
  name = "${var.PROJECT_NAME}-stepfunctions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Policy for Step Functions to invoke Lambda functions
resource "aws_iam_policy" "step_functions_policy" {
  name = "${var.PROJECT_NAME}-stepfunctions-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction",
          "lambda:InvokeAsync"
        ]
        Resource = [
          aws_lambda_function.sf_email_fetcher.arn,
          "${aws_lambda_function.sf_email_fetcher.arn}:*",
          aws_lambda_function.sf_classifier.arn,
          "${aws_lambda_function.sf_classifier.arn}:*",
          aws_lambda_function.sf_content_extractor.arn,
          "${aws_lambda_function.sf_content_extractor.arn}:*",
          aws_lambda_function.sf_research.arn,
          "${aws_lambda_function.sf_research.arn}:*",
          aws_lambda_function.sf_analysis.arn,
          "${aws_lambda_function.sf_analysis.arn}:*",
          aws_lambda_function.sf_critic.arn,
          "${aws_lambda_function.sf_critic.arn}:*",
          aws_lambda_function.sf_digest_sender.arn,
          "${aws_lambda_function.sf_digest_sender.arn}:*",
          aws_lambda_function.sf_error_handler.arn,
          "${aws_lambda_function.sf_error_handler.arn}:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution",
          "states:DescribeExecution",
          "states:StopExecution"
        ]
        Resource = [
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:stateMachine:${var.PROJECT_NAME}-pipeline",
          "arn:aws:states:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:execution:${var.PROJECT_NAME}-pipeline:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = aws_iam_role.lambda_role.arn
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "lambda.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "step_functions_policy" {
  role       = aws_iam_role.step_functions_role.name
  policy_arn = aws_iam_policy.step_functions_policy.arn
}

# ========================================
# CLOUDWATCH LOG GROUP FOR STEP FUNCTIONS
# ========================================

resource "aws_cloudwatch_log_group" "step_functions" {
  name              = "/aws/vendedlogs/states/${var.PROJECT_NAME}-pipeline"
  retention_in_days = 7

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ========================================
# STEP FUNCTIONS STATE MACHINE
# ========================================

# Read and process the state machine definition
locals {
  state_machine_definition = templatefile(
    "${path.module}/stepfunctions/ai-digest-pipeline.asl.json",
    {
      email_fetcher_arn     = aws_lambda_function.sf_email_fetcher.arn
      classifier_arn        = aws_lambda_function.sf_classifier.arn
      content_extractor_arn = aws_lambda_function.sf_content_extractor.arn
      research_arn          = aws_lambda_function.sf_research.arn
      analysis_arn          = aws_lambda_function.sf_analysis.arn
      critic_arn            = aws_lambda_function.sf_critic.arn
      digest_sender_arn     = aws_lambda_function.sf_digest_sender.arn
      error_handler_arn     = aws_lambda_function.sf_error_handler.arn
    }
  )
}

resource "aws_sfn_state_machine" "ai_digest_pipeline" {
  name     = "${var.PROJECT_NAME}-pipeline"
  role_arn = aws_iam_role.step_functions_role.arn
  type     = "EXPRESS"  # Express workflow for lower cost and synchronous execution

  definition = local.state_machine_definition
  publish = false  # Skip validation
  
  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.step_functions.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  tracing_configuration {
    enabled = true
  }

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    Type        = "Pipeline"
    ManagedBy   = "Terraform"
  }
}

# ========================================
# EVENTBRIDGE RULE FOR SCHEDULED EXECUTION
# ========================================

# IAM role for EventBridge to invoke Step Functions
resource "aws_iam_role" "eventbridge_stepfunctions_role" {
  name = "${var.PROJECT_NAME}-eventbridge-sf-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_iam_policy" "eventbridge_stepfunctions_policy" {
  name = "${var.PROJECT_NAME}-eventbridge-sf-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution"
        ]
        Resource = aws_sfn_state_machine.ai_digest_pipeline.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eventbridge_stepfunctions_policy" {
  role       = aws_iam_role.eventbridge_stepfunctions_role.name
  policy_arn = aws_iam_policy.eventbridge_stepfunctions_policy.arn
}

# Weekly schedule rule
resource "aws_cloudwatch_event_rule" "weekly_pipeline" {
  name                = "${var.PROJECT_NAME}-weekly-pipeline"
  description         = "Trigger AI Digest pipeline every Sunday at 10am UTC"
  schedule_expression = "cron(0 10 ? * SUN *)"
  state               = "ENABLED"

  tags = {
    Project     = var.PROJECT_NAME
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_cloudwatch_event_target" "step_functions_target" {
  rule      = aws_cloudwatch_event_rule.weekly_pipeline.name
  target_id = "StepFunctionsTarget"
  arn       = aws_sfn_state_machine.ai_digest_pipeline.arn
  role_arn  = aws_iam_role.eventbridge_stepfunctions_role.arn

  input = jsonencode({
    mode = "weekly"
  })
}

# ========================================
# CLOUDWATCH DASHBOARD
# ========================================

resource "aws_cloudwatch_dashboard" "pipeline_dashboard" {
  dashboard_name = "${var.PROJECT_NAME}-pipeline"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/States", "ExecutionsSucceeded", { stat = "Sum", label = "Successful" }],
            [".", "ExecutionsFailed", { stat = "Sum", label = "Failed" }],
            [".", "ExecutionsTimedOut", { stat = "Sum", label = "Timed Out" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.AWS_REGION
          title   = "Pipeline Executions"
          period  = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/States", "ExecutionTime", { stat = "Average", label = "Avg Duration" }],
            [".", ".", { stat = "Maximum", label = "Max Duration" }],
            [".", ".", { stat = "Minimum", label = "Min Duration" }]
          ]
          view   = "timeSeries"
          region = var.AWS_REGION
          title  = "Execution Duration (ms)"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", { stat = "Average" }],
            [".", "Errors", { stat = "Sum" }],
            [".", "Throttles", { stat = "Sum" }]
          ]
          view   = "timeSeries"
          region = var.AWS_REGION
          title  = "Lambda Metrics"
          period = 300
        }
      },
      {
        type = "log"
        properties = {
          query   = "SOURCE '${aws_cloudwatch_log_group.step_functions.name}' | fields @timestamp, @message | sort @timestamp desc | limit 100"
          region  = var.AWS_REGION
          title   = "Recent Pipeline Logs"
        }
      }
    ]
  })
}

# ========================================
# OUTPUTS
# ========================================

output "step_functions_arn" {
  value       = aws_sfn_state_machine.ai_digest_pipeline.arn
  description = "ARN of the Step Functions state machine"
}

output "step_functions_name" {
  value       = aws_sfn_state_machine.ai_digest_pipeline.name
  description = "Name of the Step Functions state machine"
}

output "step_functions_dashboard_url" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.AWS_REGION}#dashboards:name=${aws_cloudwatch_dashboard.pipeline_dashboard.dashboard_name}"
  description = "URL to CloudWatch dashboard for pipeline monitoring"
}

output "step_functions_console_url" {
  value       = "https://console.aws.amazon.com/states/home?region=${var.AWS_REGION}#/statemachines/view/${aws_sfn_state_machine.ai_digest_pipeline.arn}"
  description = "URL to Step Functions console for visual debugging"
}