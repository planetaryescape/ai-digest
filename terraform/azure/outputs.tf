output "function_app_name" {
  value       = azurerm_linux_function_app.main.name
  description = "Name of the Function App"
}

output "function_app_default_hostname" {
  value       = azurerm_linux_function_app.main.default_hostname
  description = "Default hostname of the Function App"
}

output "manual_trigger_url" {
  value       = "https://${azurerm_linux_function_app.main.default_hostname}/api/run"
  description = "URL to manually trigger the digest (requires function key)"
  sensitive   = false
}

output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Resource group name"
}

output "storage_account_name" {
  value       = azurerm_storage_account.main.name
  description = "Storage account name"
}

output "key_vault_name" {
  value       = azurerm_key_vault.main.name
  description = "Key Vault name"
}

output "key_vault_uri" {
  value       = azurerm_key_vault.main.vault_uri
  description = "Key Vault URI"
}

output "application_insights_instrumentation_key" {
  value       = azurerm_application_insights.main.instrumentation_key
  description = "Application Insights instrumentation key"
  sensitive   = true
}

output "next_steps" {
  value = <<-EOT
    
    ✅ Infrastructure deployed successfully!
    
    Next steps:
    1. Add secrets to Key Vault:
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name gmail-client-id --value "YOUR_VALUE"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name gmail-client-secret --value "YOUR_VALUE"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name gmail-refresh-token --value "YOUR_VALUE"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name openai-api-key --value "YOUR_VALUE"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name helicone-api-key --value "YOUR_VALUE"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name resend-api-key --value "YOUR_VALUE"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name resend-from --value "AI Digest <digest@yourdomain.com>"
       az keyvault secret set --vault-name ${azurerm_key_vault.main.name} --name sentry-dsn --value "YOUR_VALUE" (optional)
    
    2. Get the function key for manual triggers:
       az functionapp function keys list --name ${azurerm_linux_function_app.main.name} --resource-group ${azurerm_resource_group.main.name} --function-name run-now
    
    3. Test manual trigger:
       curl "https://${azurerm_linux_function_app.main.default_hostname}/api/run?code=FUNCTION_KEY"
    
    4. View logs:
       az webapp log tail --name ${azurerm_linux_function_app.main.name} --resource-group ${azurerm_resource_group.main.name}
    
    Timer is set to run every Sunday at 8:00 AM ${var.time_zone}.
  EOT
}