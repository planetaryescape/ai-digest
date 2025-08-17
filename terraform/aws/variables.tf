variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "ai-digest"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Gmail OAuth Configuration
variable "gmail_client_id" {
  description = "Gmail OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "gmail_client_secret" {
  description = "Gmail OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "gmail_refresh_token" {
  description = "Gmail OAuth Refresh Token"
  type        = string
  sensitive   = true
}

# OpenAI Configuration
variable "openai_api_key" {
  description = "OpenAI API Key"
  type        = string
  sensitive   = true
}

variable "helicone_api_key" {
  description = "Helicone API Key"
  type        = string
  sensitive   = true
}

# Email Configuration
variable "resend_api_key" {
  description = "Resend API Key"
  type        = string
  sensitive   = true
}

variable "recipient_email" {
  description = "Recipient email address"
  type        = string
}

# Processing Configuration
variable "older_than_days" {
  description = "Process emails older than this many days"
  type        = number
  default     = 30
}

variable "max_links_per_email" {
  description = "Maximum links to process per email"
  type        = number
  default     = 2
}

variable "max_sections" {
  description = "Maximum sections in digest"
  type        = number
  default     = 25
}

variable "keywords" {
  description = "Additional keywords (comma-separated)"
  type        = string
  default     = ""
}

variable "professions" {
  description = "Professions to include (comma-separated)"
  type        = string
  default     = "Software Engineer,Product Manager,Designer,Finance,Accounting,Lawyer,Teacher,Nurse,Graphic Designer,Entrepreneur"
}