# CloudWatch Dashboard for AI Digest Monitoring
resource "aws_cloudwatch_dashboard" "ai_digest_main" {
  dashboard_name = "${var.PROJECT_NAME}-main-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Lambda Execution Overview
      {
        type = "metric"
        properties = {
          title = "Lambda Execution Overview"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Total Invocations" }],
            [".", "Errors", { stat = "Sum", label = "Total Errors", color = "#d62728" }],
            [".", "Throttles", { stat = "Sum", label = "Throttles", color = "#ff7f0e" }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
          yAxis = { left = { min = 0 } }
          annotations = {
            horizontal = [
              {
                label = "Error Threshold"
                value = 5
                fill = "above"
                color = "#d62728"
              }
            ]
          }
        }
        width = 12
        height = 6
        x = 0
        y = 0
      },
      
      # Lambda Duration Metrics
      {
        type = "metric"
        properties = {
          title = "Lambda Execution Duration"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Duration", { stat = "Average", label = "Avg Duration" }],
            ["...", { stat = "Maximum", label = "Max Duration", color = "#ff7f0e" }],
            ["...", { stat = "Minimum", label = "Min Duration", color = "#2ca02c" }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
          yAxis = { 
            left = { 
              min = 0,
              label = "Duration (ms)"
            } 
          }
        }
        width = 12
        height = 6
        x = 12
        y = 0
      },

      # Function-specific Metrics
      {
        type = "metric"
        properties = {
          title = "Function-Specific Performance"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Duration", { 
              stat = "Average", 
              label = "Weekly Digest",
              dimensions = { FunctionName = aws_lambda_function.weekly_digest.function_name }
            }],
            ["...", { 
              stat = "Average", 
              label = "Run Now",
              dimensions = { FunctionName = aws_lambda_function.run_now.function_name }
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
        }
        width = 8
        height = 6
        x = 0
        y = 6
      },

      # Error Rate by Function
      {
        type = "metric"
        properties = {
          title = "Error Rate by Function"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Errors", { 
              stat = "Sum", 
              label = "Weekly Digest Errors",
              dimensions = { FunctionName = aws_lambda_function.weekly_digest.function_name },
              color = "#d62728"
            }],
            ["...", { 
              stat = "Sum", 
              label = "Run Now Errors",
              dimensions = { FunctionName = aws_lambda_function.run_now.function_name },
              color = "#ff7f0e"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
          yAxis = { left = { min = 0 } }
        }
        width = 8
        height = 6
        x = 8
        y = 6
      },

      # Memory Utilization
      {
        type = "metric"
        properties = {
          title = "Memory Utilization"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "MemoryUtilization", { 
              stat = "Average",
              dimensions = { FunctionName = aws_lambda_function.weekly_digest.function_name },
              label = "Weekly Digest Memory %"
            }],
            ["...", { 
              stat = "Maximum",
              dimensions = { FunctionName = aws_lambda_function.weekly_digest.function_name },
              label = "Weekly Digest Max Memory %",
              color = "#ff7f0e"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
          yAxis = { 
            left = { 
              min = 0,
              max = 100,
              label = "Memory %"
            } 
          }
        }
        width = 8
        height = 6
        x = 16
        y = 6
      },

      # DynamoDB Operations
      {
        type = "metric"
        properties = {
          title = "DynamoDB Operations"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/DynamoDB", "UserErrors", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_ai_senders.name },
              label = "AI Senders Errors",
              color = "#d62728"
            }],
            [".", "ConsumedReadCapacityUnits", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_ai_senders.name },
              label = "AI Senders Read Units"
            }],
            [".", "ConsumedWriteCapacityUnits", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_ai_senders.name },
              label = "AI Senders Write Units"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
        }
        width = 12
        height = 6
        x = 0
        y = 12
      },

      # S3 Request Metrics
      {
        type = "metric"
        properties = {
          title = "S3 Storage Operations"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/S3", "AllRequests", { 
              stat = "Sum",
              dimensions = { 
                BucketName = aws_s3_bucket.processed_emails.id,
                FilterId = "EntireBucket"
              },
              label = "Total Requests"
            }],
            [".", "4xxErrors", { 
              stat = "Sum",
              dimensions = { 
                BucketName = aws_s3_bucket.processed_emails.id,
                FilterId = "EntireBucket"
              },
              label = "4xx Errors",
              color = "#ff7f0e"
            }],
            [".", "5xxErrors", { 
              stat = "Sum",
              dimensions = { 
                BucketName = aws_s3_bucket.processed_emails.id,
                FilterId = "EntireBucket"
              },
              label = "5xx Errors",
              color = "#d62728"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
        }
        width = 12
        height = 6
        x = 12
        y = 12
      },

      # Concurrent Executions
      {
        type = "metric"
        properties = {
          title = "Concurrent Executions"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "ConcurrentExecutions", { 
              stat = "Maximum",
              label = "Max Concurrent"
            }],
            [".", "UnreservedConcurrentExecutions", { 
              stat = "Maximum",
              label = "Unreserved Concurrent",
              color = "#2ca02c"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 60
          annotations = {
            horizontal = [
              {
                label = "Account Limit"
                value = 1000
                fill = "above"
                color = "#d62728"
              }
            ]
          }
        }
        width = 8
        height = 6
        x = 0
        y = 18
      },

      # API Gateway Metrics
      {
        type = "metric"
        properties = {
          title = "API Gateway Performance"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApiGateway", "Count", { 
              stat = "Sum",
              dimensions = { 
                ApiName = aws_api_gateway_rest_api.api.name,
                Stage = aws_api_gateway_stage.prod.stage_name
              },
              label = "Total Requests"
            }],
            [".", "4XXError", { 
              stat = "Sum",
              dimensions = { 
                ApiName = aws_api_gateway_rest_api.api.name,
                Stage = aws_api_gateway_stage.prod.stage_name
              },
              label = "4XX Errors",
              color = "#ff7f0e"
            }],
            [".", "5XXError", { 
              stat = "Sum",
              dimensions = { 
                ApiName = aws_api_gateway_rest_api.api.name,
                Stage = aws_api_gateway_stage.prod.stage_name
              },
              label = "5XX Errors",
              color = "#d62728"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
        }
        width = 8
        height = 6
        x = 8
        y = 18
      },

      # API Gateway Latency
      {
        type = "metric"
        properties = {
          title = "API Gateway Latency"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApiGateway", "Latency", { 
              stat = "Average",
              dimensions = { 
                ApiName = aws_api_gateway_rest_api.api.name,
                Stage = aws_api_gateway_stage.prod.stage_name
              },
              label = "Avg Latency"
            }],
            ["...", { 
              stat = "p99",
              dimensions = { 
                ApiName = aws_api_gateway_rest_api.api.name,
                Stage = aws_api_gateway_stage.prod.stage_name
              },
              label = "p99 Latency",
              color = "#ff7f0e"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 300
          yAxis = { 
            left = { 
              min = 0,
              label = "Latency (ms)"
            } 
          }
        }
        width = 8
        height = 6
        x = 16
        y = 18
      },

      # Recent Lambda Logs
      {
        type = "log"
        properties = {
          title = "Recent Error Logs"
          region = data.aws_region.current.name
          query = "SOURCE '${aws_cloudwatch_log_group.weekly_digest.name}' | SOURCE '${aws_cloudwatch_log_group.run_now.name}' | fields @timestamp, @message | filter @message like /ERROR/ or @message like /Error/ | sort @timestamp desc | limit 20"
          stacked = false
          view = "table"
        }
        width = 24
        height = 6
        x = 0
        y = 24
      }
    ]
  })
}

# Cost Monitoring Dashboard
resource "aws_cloudwatch_dashboard" "ai_digest_costs" {
  dashboard_name = "${var.PROJECT_NAME}-cost-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Estimated Lambda Costs
      {
        type = "metric"
        properties = {
          title = "Estimated Lambda Costs (Daily)"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Duration", { 
              stat = "Sum",
              label = "Total Duration (ms)",
              id = "m1",
              visible = false
            }],
            [".", "Invocations", { 
              stat = "Sum",
              label = "Total Invocations",
              id = "m2",
              visible = false
            }],
            [ { 
              expression = "(m1 / 1000 * 256 / 1024) * 0.0000166667 + m2 * 0.0000002",
              label = "Estimated Cost ($)",
              id = "e1"
            }]
          ]
          view = "singleValue"
          period = 86400
        }
        width = 6
        height = 4
        x = 0
        y = 0
      },

      # DynamoDB Consumed Capacity
      {
        type = "metric"
        properties = {
          title = "DynamoDB Consumed Capacity"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_ai_senders.name },
              label = "AI Senders RCU"
            }],
            [".", "ConsumedWriteCapacityUnits", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_ai_senders.name },
              label = "AI Senders WCU"
            }],
            [".", "ConsumedReadCapacityUnits", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_non_ai_senders.name },
              label = "Non-AI Senders RCU"
            }],
            [".", "ConsumedWriteCapacityUnits", { 
              stat = "Sum",
              dimensions = { TableName = aws_dynamodb_table.known_non_ai_senders.name },
              label = "Non-AI Senders WCU"
            }]
          ]
          view = "timeSeries"
          stacked = true
          period = 3600
          yAxis = { 
            left = { 
              min = 0,
              label = "Capacity Units"
            } 
          }
        }
        width = 12
        height = 6
        x = 6
        y = 0
      },

      # S3 Storage Size
      {
        type = "metric"
        properties = {
          title = "S3 Storage Usage"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/S3", "BucketSizeBytes", { 
              stat = "Average",
              dimensions = { 
                BucketName = aws_s3_bucket.processed_emails.id,
                StorageType = "StandardStorage"
              },
              label = "Processed Emails Size"
            }],
            [".", "NumberOfObjects", { 
              stat = "Average",
              dimensions = { 
                BucketName = aws_s3_bucket.processed_emails.id,
                StorageType = "AllStorageTypes"
              },
              label = "Number of Objects",
              yAxis = "right"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 86400
          yAxis = { 
            left = { 
              min = 0,
              label = "Size (Bytes)"
            },
            right = {
              min = 0,
              label = "Object Count"
            }
          }
        }
        width = 6
        height = 6
        x = 18
        y = 0
      },

      # API Gateway Request Count
      {
        type = "metric"
        properties = {
          title = "API Gateway Usage"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/ApiGateway", "Count", { 
              stat = "Sum",
              dimensions = { 
                ApiName = aws_api_gateway_rest_api.api.name,
                Stage = aws_api_gateway_stage.prod.stage_name
              },
              label = "API Requests",
              id = "m1"
            }],
            [ { 
              expression = "m1 * 0.000001",
              label = "Estimated Cost ($)",
              id = "e1",
              yAxis = "right"
            }]
          ]
          view = "timeSeries"
          stacked = false
          period = 3600
          yAxis = { 
            left = { 
              min = 0,
              label = "Request Count"
            },
            right = {
              min = 0,
              label = "Cost ($)"
            }
          }
        }
        width = 12
        height = 6
        x = 0
        y = 6
      },

      # Lambda Invocation Trends
      {
        type = "metric"
        properties = {
          title = "Lambda Invocation Trends (7 days)"
          region = data.aws_region.current.name
          metrics = [
            ["AWS/Lambda", "Invocations", { 
              stat = "Sum",
              dimensions = { FunctionName = aws_lambda_function.weekly_digest.function_name },
              label = "Weekly Digest"
            }],
            ["...", { 
              stat = "Sum",
              dimensions = { FunctionName = aws_lambda_function.run_now.function_name },
              label = "Run Now"
            }]
          ]
          view = "timeSeries"
          stacked = true
          period = 86400
          start = "-P7D"
        }
        width = 12
        height = 6
        x = 12
        y = 6
      }
    ]
  })
}

# Agent-Specific Metrics Dashboard
resource "aws_cloudwatch_dashboard" "ai_digest_agents" {
  dashboard_name = "${var.PROJECT_NAME}-agents-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # Agent Performance Overview
      {
        type = "text"
        properties = {
          markdown = <<-EOF
          # Agent Performance Monitoring

          This dashboard tracks the performance of individual AI Digest agents:
          - **EmailFetcherAgent**: Gmail API interactions
          - **ClassifierAgent**: Email classification (AI/non-AI)
          - **ContentExtractorAgent**: Article extraction via Firecrawl
          - **ResearchAgent**: Web enrichment via Brave Search
          - **AnalysisAgent**: Deep GPT-4o/5 analysis
          - **CriticAgent**: Opinionated commentary

          ## Key Metrics
          - Circuit breaker activations
          - API call costs
          - Processing times
          - Error rates by agent
          EOF
        }
        width = 24
        height = 4
        x = 0
        y = 0
      },

      # Circuit Breaker Status
      {
        type = "log"
        properties = {
          title = "Circuit Breaker Activations"
          region = data.aws_region.current.name
          query = <<-QUERY
          fields @timestamp, @message
          | filter @message like /circuit.*breaker/i or @message like /circuit.*state/i
          | sort @timestamp desc
          | limit 50
          QUERY
          stacked = false
          view = "table"
        }
        width = 12
        height = 6
        x = 0
        y = 4
      },

      # Agent Processing Times
      {
        type = "log"
        properties = {
          title = "Agent Processing Times"
          region = data.aws_region.current.name
          query = <<-QUERY
          fields @timestamp, @message
          | filter @message like /Agent.*duration/i or @message like /Agent.*completed/i
          | parse @message /(?<agent>\w+Agent).*duration.*?(?<duration>\d+)/
          | stats avg(duration) as avg_duration, max(duration) as max_duration by agent
          QUERY
          stacked = false
          view = "table"
        }
        width = 12
        height = 6
        x = 12
        y = 4
      },

      # OpenAI API Costs
      {
        type = "log"
        properties = {
          title = "OpenAI API Cost Tracking"
          region = data.aws_region.current.name
          query = <<-QUERY
          fields @timestamp, @message
          | filter @message like /openai.*cost/i or @message like /gpt.*tokens/i
          | parse @message /cost.*?(?<cost>[\d.]+)/
          | stats sum(cost) as total_cost
          QUERY
          stacked = false
          view = "singleValue"
        }
        width = 8
        height = 4
        x = 0
        y = 10
      },

      # External API Errors
      {
        type = "log"
        properties = {
          title = "External API Errors"
          region = data.aws_region.current.name
          query = <<-QUERY
          fields @timestamp, @message
          | filter @message like /gmail.*error/i 
               or @message like /openai.*error/i
               or @message like /firecrawl.*error/i
               or @message like /brave.*error/i
               or @message like /resend.*error/i
          | stats count() as error_count by bin(5m)
          QUERY
          stacked = false
          view = "lineChart"
        }
        width = 16
        height = 4
        x = 8
        y = 10
      },

      # Email Processing Volume
      {
        type = "log"
        properties = {
          title = "Email Processing Volume"
          region = data.aws_region.current.name
          query = <<-QUERY
          fields @timestamp, @message
          | filter @message like /emails.*processed/i or @message like /digest.*generated/i
          | parse @message /processed.*?(?<count>\d+)/
          | stats sum(count) as total_emails by bin(1h)
          QUERY
          stacked = false
          view = "barChart"
        }
        width = 24
        height = 6
        x = 0
        y = 14
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.PROJECT_NAME}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors lambda errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.weekly_digest.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${var.PROJECT_NAME}-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "1"
  alarm_description   = "This metric monitors lambda throttles"
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "${var.PROJECT_NAME}-lambda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Average"
  threshold           = "240000"  # 4 minutes in milliseconds
  alarm_description   = "Alert when Lambda duration exceeds 4 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.weekly_digest.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx" {
  alarm_name          = "${var.PROJECT_NAME}-api-4xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert on high 4XX error rate"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.api.name
    Stage   = aws_api_gateway_stage.prod.stage_name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx" {
  alarm_name          = "${var.PROJECT_NAME}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert on 5XX errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.api.name
    Stage   = aws_api_gateway_stage.prod.stage_name
  }
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_errors" {
  alarm_name          = "${var.PROJECT_NAME}-dynamodb-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "UserErrors"
  namespace           = "AWS/DynamoDB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert on DynamoDB user errors"
  treat_missing_data  = "notBreaching"

  dimensions = {
    TableName = aws_dynamodb_table.known_ai_senders.name
  }
}

# S3 Request Metrics Filter (required for S3 metrics)
resource "aws_s3_bucket_metric" "processed_emails_metrics" {
  bucket = aws_s3_bucket.processed_emails.id
  name   = "EntireBucket"
}

# Outputs for dashboard URLs
output "main_dashboard_url" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.ai_digest_main.dashboard_name}"
  description = "URL to the main CloudWatch dashboard"
}

output "cost_dashboard_url" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.ai_digest_costs.dashboard_name}"
  description = "URL to the cost monitoring dashboard"
}

output "agents_dashboard_url" {
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.ai_digest_agents.dashboard_name}"
  description = "URL to the agents monitoring dashboard"
}