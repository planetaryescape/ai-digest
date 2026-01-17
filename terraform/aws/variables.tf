variable "AWS_REGION" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "PROJECT_NAME" {
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
variable "GMAIL_CLIENT_ID" {
  description = "Gmail OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "GMAIL_CLIENT_SECRET" {
  description = "Gmail OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "GMAIL_REFRESH_TOKEN" {
  description = "Gmail OAuth Refresh Token"
  type        = string
  sensitive   = true
}

# OpenAI Configuration
variable "OPENAI_API_KEY" {
  description = "OpenAI API Key"
  type        = string
  sensitive   = true
}

variable "HELICONE_API_KEY" {
  description = "Helicone API Key"
  type        = string
  sensitive   = true
}

# Email Configuration
variable "RESEND_API_KEY" {
  description = "Resend API Key"
  type        = string
  sensitive   = true
}

variable "RECIPIENT_EMAIL" {
  description = "Recipient email address"
  type        = string
}

variable "frontend_url" {
  description = "Frontend URL for re-auth links"
  type        = string
  default     = "https://ai-digest-vert.vercel.app"
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

# Step Functions Configuration
variable "ENABLE_FIRECRAWL" {
  description = "Enable Firecrawl for content extraction"
  type        = string
  default     = "false"
}

variable "FIRECRAWL_API_KEY" {
  description = "Firecrawl API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ENABLE_RESEARCH" {
  description = "Enable Brave Search for research"
  type        = string
  default     = "false"
}

variable "BRAVE_API_KEY" {
  description = "Brave Search API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ENABLE_CRITIC_AGENT" {
  description = "Enable critic agent for commentary"
  type        = string
  default     = "true"
}

variable "ANALYSIS_MODEL" {
  description = "Model to use for analysis and critique"
  type        = string
  default     = "gpt-4o"
}

variable "ARCHIVE_AFTER_PROCESSING" {
  description = "Archive emails after processing"
  type        = string
  default     = "false"
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

variable "allowed_origins" {
  description = "Allowed CORS origins for Lambda function URLs"
  type        = list(string)
  default     = ["*"]
  # Note: Lambda Function URLs don't support wildcard subdomains like https://*.vercel.app
  # You must use either specific domains or "*" for all origins
  # For production, update this with your actual Vercel domain:
  # default = ["http://localhost:3000", "https://your-app.vercel.app"]
}

# Pipeline-specific variables are already defined above

variable "enable_weekly_schedule" {
  description = "Enable weekly EventBridge schedule"
  type        = bool
  default     = false
}