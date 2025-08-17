# Resource Group
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

# Storage Account
resource "azurerm_storage_account" "main" {
  name                     = var.storage_account_name
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"
  tags                     = var.tags
}

# Storage Table for tracking processed emails
resource "azurerm_storage_table" "processed_emails" {
  name                 = "ProcessedEmails"
  storage_account_name = azurerm_storage_account.main.name
}

# Application Insights (optional - can be disabled to save costs)
resource "azurerm_application_insights" "main" {
  name                = "${var.project_name}-insights"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  application_type    = "web"
  retention_in_days   = 30
  tags                = var.tags
}

# App Service Plan (Consumption - Y1)
resource "azurerm_service_plan" "main" {
  name                = "${var.project_name}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "Y1" # Consumption plan for cost optimization
  tags                = var.tags
}

# Storage container for deployment package
resource "azurerm_storage_container" "deployments" {
  name                  = "function-releases"
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Upload deployment package
resource "azurerm_storage_blob" "function_package" {
  name                   = "package-${filemd5("${path.module}/package.zip")}.zip"
  storage_account_name   = azurerm_storage_account.main.name
  storage_container_name = azurerm_storage_container.deployments.name
  type                   = "Block"
  source                 = "${path.module}/package.zip"
}

# Generate SAS token for package access
data "azurerm_storage_account_sas" "package_sas" {
  connection_string = azurerm_storage_account.main.primary_connection_string
  https_only        = true
  start             = timeadd(timestamp(), "-15m")
  expiry            = timeadd(timestamp(), "8760h") # 1 year

  resource_types {
    service   = false
    container = false
    object    = true
  }

  services {
    blob  = true
    queue = false
    table = false
    file  = false
  }

  permissions {
    read    = true
    write   = false
    delete  = false
    list    = false
    add     = false
    create  = false
    update  = false
    process = false
    tag     = false
    filter  = false
  }
}

# Key Vault for secrets
resource "azurerm_key_vault" "main" {
  name                       = var.key_vault_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  purge_protection_enabled   = false
  soft_delete_retention_days = 7
  tags                       = var.tags

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Recover", "Backup", "Restore", "Purge"
    ]
  }
}

# Linux Function App
resource "azurerm_linux_function_app" "main" {
  name                       = var.app_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key
  service_plan_id            = azurerm_service_plan.main.id
  functions_extension_version = "~4"
  https_only                 = true
  tags                       = var.tags

  site_config {
    always_on = false # Keep false for consumption plan
    
    application_stack {
      node_version = "22" # Latest LTS
    }

    cors {
      allowed_origins = ["https://portal.azure.com"]
    }
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    # Function runtime settings
    WEBSITE_RUN_FROM_PACKAGE       = "https://${azurerm_storage_account.main.name}.blob.core.windows.net/${azurerm_storage_container.deployments.name}/${azurerm_storage_blob.function_package.name}?${data.azurerm_storage_account_sas.package_sas.sas}"
    # WEBSITE_TIME_ZONE not supported on Linux Consumption plans - using UTC
    FUNCTIONS_WORKER_RUNTIME       = "node"
    WEBSITE_NODE_DEFAULT_VERSION   = "~22"
    
    # Application Insights (optional)
    APPLICATIONINSIGHTS_CONNECTION_STRING = azurerm_application_insights.main.connection_string
    
    # Storage for state tracking
    AZURE_STORAGE_CONNECTION_STRING = azurerm_storage_account.main.primary_connection_string
    
    # Gmail OAuth (stored in Key Vault)
    GMAIL_CLIENT_ID     = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=gmail-client-id)"
    GMAIL_CLIENT_SECRET = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=gmail-client-secret)"
    GMAIL_REFRESH_TOKEN = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=gmail-refresh-token)"
    
    # OpenAI + Helicone (stored in Key Vault)
    OPENAI_API_KEY   = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=openai-api-key)"
    HELICONE_API_KEY = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=helicone-api-key)"
    OPENAI_MODEL     = var.openai_model
    
    # Resend (stored in Key Vault)
    RESEND_API_KEY = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=resend-api-key)"
    RESEND_FROM    = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=resend-from)"
    
    # Configuration
    RECIPIENT_EMAIL     = var.recipient_email
    OLDER_THAN_DAYS     = tostring(var.older_than_days)
    MAX_LINKS_PER_EMAIL = tostring(var.max_links_per_email)
    MAX_SECTIONS        = tostring(var.max_sections)
    KEYWORDS            = var.keywords
    PROFESSIONS         = var.professions
    
    # Product context (JSON string)
    PRODUCT_CONTEXT = jsonencode({
      owner = "Bhekani"
      apps = [
        {
          name = "Interview Optimiser"
          url  = "https://interviewoptimiser.com"
          desc = "Mock interviews & coaching"
        },
        {
          name = "CV Optimiser"
          url  = "https://cvoptimiser.com"
          desc = "AI CV optimization"
        },
        {
          name = "Reference Optimiser"
          url  = "https://referenceoptimiser.com"
          desc = "Reference letter generation"
        },
        {
          name = "Dealbase"
          url  = "https://dealbase.com"
          desc = "Startup funding database"
        },
        {
          name = "Blog"
          url  = "https://bhekani.com"
          desc = "Technical & indie content"
        }
      ]
    })
    
    # Sentry (optional)
    SENTRY_DSN = "@Microsoft.KeyVault(VaultName=${azurerm_key_vault.main.name};SecretName=sentry-dsn)"
  }

  depends_on = [
    azurerm_storage_blob.function_package,
    azurerm_key_vault.main
  ]
}

# Grant Function App access to Key Vault
resource "azurerm_key_vault_access_policy" "function_app" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_function_app.main.identity[0].principal_id

  secret_permissions = ["Get", "List"]
}

# Data source for current Azure client
data "azurerm_client_config" "current" {}