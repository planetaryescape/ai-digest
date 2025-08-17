variable "azure_subscription_id" {
  type        = string
  default     = ""
  description = "Azure subscription ID (optional, uses default if not set)"
}

variable "project_name" {
  type        = string
  default     = "ai-digest"
  description = "Project name used for resource naming"
}

variable "location" {
  type        = string
  default     = "uksouth"
  description = "Azure region for resources"
}

variable "resource_group_name" {
  type        = string
  default     = "rg-ai-digest"
  description = "Resource group name"
}

variable "app_name" {
  type        = string
  default     = "fn-ai-digest-bhekanik"
  description = "Function app name"
}

variable "storage_account_name" {
  type        = string
  default     = "staidigestbhekanik"
  description = "Storage account name (must be globally unique)"
}

variable "key_vault_name" {
  type        = string
  default     = "kv-ai-digest-bhekanik"
  description = "Key Vault name (must be globally unique)"
}

variable "recipient_email" {
  type        = string
  description = "Email address to send digests to"
}

variable "time_zone" {
  type        = string
  default     = "GMT Standard Time"
  description = "Time zone for timer trigger (London with DST)"
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
  default     = "Software Engineer,Product Manager,Designer,Finance,Accounting,Lawyer,Teacher,Nurse,Graphic Designer,Entrepreneur"
  description = "Professions to generate advice for (comma-separated)"
}

variable "tags" {
  type        = map(string)
  default = {
    Environment = "Production"
    Project     = "AI Digest"
    ManagedBy   = "Terraform"
  }
  description = "Tags to apply to all resources"
}