variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region for resources"
}

variable "project_name" {
  type        = string
  default     = "ai-digest"
  description = "Project name used for resource naming"
}

variable "environment" {
  type        = string
  default     = "production"
  description = "Environment name"
}

variable "recipient_email" {
  type        = string
  description = "Email address to send digests to"
}

variable "schedule_expression" {
  type        = string
  default     = "cron(0 8 ? * SUN *)"
  description = "CloudWatch Events schedule expression (UTC) - Default: Every Sunday at 8 AM"
}

variable "older_than_days" {
  type        = number
  default     = 30
  description = "Archive emails older than this many days"
}

variable "max_links_per_email" {
  type        = number
  default     = 2
  description = "Maximum number of links to fetch per email"
}

variable "max_sections" {
  type        = number
  default     = 25
  description = "Maximum number of emails to summarize"
}

variable "openai_model" {
  type        = string
  default     = "o4-mini"
  description = "Default OpenAI model to use"
}

variable "classification_model" {
  type        = string
  default     = "o4-mini"
  description = "Model for email classification (compact reasoning)"
}

variable "extraction_model" {
  type        = string
  default     = "o4-mini"
  description = "Model for article extraction"
}

variable "summarization_model" {
  type        = string
  default     = "gpt-5"
  description = "Model for digest summarization (most advanced analysis)"
}

variable "analysis_model" {
  type        = string
  default     = "o4-mini"
  description = "Model for critical thinking and analysis (smart reasoning)"
}

variable "keywords" {
  type        = string
  default     = ""
  description = "Additional keywords for AI detection (comma-separated)"
}

variable "professions" {
  type        = string
  default     = "Software Engineer,ML Engineer,Data Scientist,Product Manager,Designer,Founder,Investor,Researcher,DevOps Engineer,Security Engineer,Content Creator,Marketer"
  description = "Professions to generate advice for (comma-separated)"
}

variable "lambda_timeout" {
  type        = number
  default     = 300
  description = "Lambda function timeout in seconds"
}

variable "lambda_memory" {
  type        = number
  default     = 1024
  description = "Lambda function memory in MB"
}

variable "tags" {
  type = map(string)
  default = {
    Environment = "Production"
    Project     = "AI Digest"
    ManagedBy   = "Terraform"
  }
  description = "Tags to apply to all resources"
}