output "lambda_weekly_digest_arn" {
  value       = aws_lambda_function.weekly_digest.arn
  description = "ARN of the weekly digest Lambda function"
}

output "lambda_run_now_arn" {
  value       = aws_lambda_function.run_now.arn
  description = "ARN of the run-now Lambda function"
}

output "api_gateway_url" {
  value       = "${aws_api_gateway_deployment.api.invoke_url}/run"
  description = "URL for manual trigger endpoint"
}

output "api_key_id" {
  value       = aws_api_gateway_api_key.api_key.id
  description = "API Key ID for authentication"
  sensitive   = true
}

output "api_key_value" {
  value       = aws_api_gateway_api_key.api_key.value
  description = "API Key value for authentication"
  sensitive   = true
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.processed_emails.name
  description = "Name of the DynamoDB table"
}

output "secrets_arn" {
  value       = aws_secretsmanager_secret.app_secrets.arn
  description = "ARN of the Secrets Manager secret"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.lambda_deployments.id
  description = "Name of the S3 bucket for Lambda deployments"
}

output "cloudwatch_log_groups" {
  value = {
    weekly_digest = aws_cloudwatch_log_group.weekly_digest.name
    run_now       = aws_cloudwatch_log_group.run_now.name
  }
  description = "CloudWatch Log Group names"
}

output "next_steps" {
  value = <<EOT
    
✅ Infrastructure deployed successfully!
    
Next steps:
1. Update secrets in AWS Secrets Manager:
   aws secretsmanager update-secret --secret-id ${aws_secretsmanager_secret.app_secrets.name} --secret-string '{"gmail_client_id":"YOUR_VALUE","gmail_client_secret":"YOUR_VALUE","gmail_refresh_token":"YOUR_VALUE","openai_api_key":"YOUR_VALUE","helicone_api_key":"YOUR_VALUE","resend_api_key":"YOUR_VALUE","resend_from":"AI Digest <digest@yourdomain.com>"}'
    
2. Test manual trigger:
   curl -X POST ${aws_api_gateway_deployment.api.invoke_url}/run \
     -H "x-api-key: $(aws apigateway get-api-key --api-key ${aws_api_gateway_api_key.api_key.id} --include-value --query value --output text)" \
     -H "Content-Type: application/json"
    
3. View logs:
   aws logs tail ${aws_cloudwatch_log_group.weekly_digest.name} --follow
    
4. Check DynamoDB table:
   aws dynamodb scan --table-name ${aws_dynamodb_table.processed_emails.name}
    
Timer is set to: ${var.schedule_expression}

EOT
  description = "Next steps for configuration"
}