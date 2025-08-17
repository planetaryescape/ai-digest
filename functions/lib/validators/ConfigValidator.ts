import { BaseValidator } from "./BaseValidator";
import { ValidationResult } from "./ValidationResult";

export interface ConfigSchema {
  projectName?: string;
  baseUrl?: string;
  domain?: string;
  supportEmail?: string;
  apps?: Array<{
    name: string;
    url: string;
    desc: string;
    keywords?: string[];
  }>;
  aiKeywords?: string[];
  maxSections?: number;
  maxLinksPerEmail?: number;
  maxOutputTokens?: number;
  olderThanDays?: number;
  professions?: string[];
  email?: {
    from?: string;
    recipient?: string;
    subject?: string;
  };
  openai?: {
    model?: string;
    apiKey?: string;
    heliconeKey?: string;
  };
  gmail?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  };
  resend?: {
    apiKey?: string;
  };
  azure?: {
    storageConnectionString?: string;
    tableName?: string;
  };
  limits?: {
    maxEmailsPerBatch?: number;
    maxProcessingTime?: number;
    maxRetries?: number;
  };
}

export class ConfigValidator extends BaseValidator<ConfigSchema> {
  validate(config: ConfigSchema): ValidationResult {
    this.result = new ValidationResult();

    // Validate basic fields
    if (config.projectName !== undefined) {
      this.validateString("projectName", config.projectName, 1, 100);
    }

    if (config.baseUrl !== undefined) {
      this.validateUrl("baseUrl", config.baseUrl);
    }

    if (config.domain !== undefined) {
      this.validateDomain("domain", config.domain);
    }

    if (config.supportEmail !== undefined) {
      this.validateEmail("supportEmail", config.supportEmail);
    }

    // Validate apps
    if (config.apps !== undefined) {
      this.validateApps(config.apps);
    }

    // Validate AI keywords
    if (config.aiKeywords !== undefined) {
      this.validateArray("aiKeywords", config.aiKeywords, 0, 1000, (keyword: unknown, index: number) => {
        if (typeof keyword !== "string" || keyword.trim().length === 0) {
          this.result.addError(`aiKeywords[${index}]`, "must be a non-empty string", keyword);
          return false;
        }
        return true;
      });
    }

    // Validate numeric limits
    if (config.maxSections !== undefined) {
      this.validateNumber("maxSections", config.maxSections, 1, 100);
    }

    if (config.maxLinksPerEmail !== undefined) {
      this.validateNumber("maxLinksPerEmail", config.maxLinksPerEmail, 0, 50);
    }

    if (config.maxOutputTokens !== undefined) {
      this.validateNumber("maxOutputTokens", config.maxOutputTokens, 100, 100000);
    }

    if (config.olderThanDays !== undefined) {
      this.validateNumber("olderThanDays", config.olderThanDays, 1, 365);
    }

    // Validate professions
    if (config.professions !== undefined) {
      this.validateArray("professions", config.professions, 1, 50, (prof: unknown, index: number) => {
        if (typeof prof !== "string" || prof.trim().length === 0) {
          this.result.addError(`professions[${index}]`, "must be a non-empty string", prof);
          return false;
        }
        return true;
      });
    }

    // Validate email config
    if (config.email) {
      this.validateEmailConfig(config.email);
    }

    // Validate OpenAI config
    if (config.openai) {
      this.validateOpenAIConfig(config.openai);
    }

    // Validate Gmail config
    if (config.gmail) {
      this.validateGmailConfig(config.gmail);
    }

    // Validate Resend config
    if (config.resend) {
      this.validateResendConfig(config.resend);
    }

    // Validate Azure config
    if (config.azure) {
      this.validateAzureConfig(config.azure);
    }

    // Validate limits
    if (config.limits) {
      this.validateLimits(config.limits);
    }

    return this.result;
  }

  private validateDomain(field: string, value: unknown): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
    if (!domainRegex.test(value)) {
      this.result.addError(field, "must be a valid domain", value);
      return false;
    }

    return true;
  }

  private validateApps(apps: unknown): void {
    if (!Array.isArray(apps)) {
      this.result.addError("apps", "must be an array", apps);
      return;
    }

    apps.forEach((app, index) => {
      if (typeof app !== "object" || app === null) {
        this.result.addError(`apps[${index}]`, "must be an object", app);
        return;
      }

      const appObj = app as any;

      if (!this.validateRequired(`apps[${index}].name`, appObj.name)) return;
      this.validateString(`apps[${index}].name`, appObj.name, 1, 100);

      if (!this.validateRequired(`apps[${index}].url`, appObj.url)) return;
      this.validateUrl(`apps[${index}].url`, appObj.url);

      if (!this.validateRequired(`apps[${index}].desc`, appObj.desc)) return;
      this.validateString(`apps[${index}].desc`, appObj.desc, 1, 500);

      if (appObj.keywords !== undefined) {
        this.validateArray(`apps[${index}].keywords`, appObj.keywords, 0, 50, (keyword: unknown, kidx: number) => {
          if (typeof keyword !== "string" || keyword.trim().length === 0) {
            this.result.addError(`apps[${index}].keywords[${kidx}]`, "must be a non-empty string", keyword);
            return false;
          }
          return true;
        });
      }
    });
  }

  private validateEmailConfig(email: any): void {
    if (email.from !== undefined) {
      this.validateString("email.from", email.from, 1, 200);
    }

    if (email.recipient !== undefined) {
      this.validateEmail("email.recipient", email.recipient);
    }

    if (email.subject !== undefined) {
      this.validateString("email.subject", email.subject, 1, 200);
    }
  }

  private validateOpenAIConfig(openai: any): void {
    if (openai.model !== undefined) {
      this.validateString("openai.model", openai.model, 1, 50);
    }

    if (openai.apiKey !== undefined) {
      this.validateApiKey("openai.apiKey", openai.apiKey);
    }

    if (openai.heliconeKey !== undefined && openai.heliconeKey !== "") {
      this.validateApiKey("openai.heliconeKey", openai.heliconeKey);
    }
  }

  private validateGmailConfig(gmail: any): void {
    if (gmail.clientId !== undefined) {
      this.validateString("gmail.clientId", gmail.clientId, 10, 200);
    }

    if (gmail.clientSecret !== undefined) {
      this.validateString("gmail.clientSecret", gmail.clientSecret, 10, 200);
    }

    if (gmail.refreshToken !== undefined) {
      this.validateString("gmail.refreshToken", gmail.refreshToken, 10, 500);
    }
  }

  private validateResendConfig(resend: any): void {
    if (resend.apiKey !== undefined && resend.apiKey !== "") {
      this.validateApiKey("resend.apiKey", resend.apiKey);
    }
  }

  private validateAzureConfig(azure: any): void {
    if (azure.storageConnectionString !== undefined && azure.storageConnectionString !== "") {
      this.validateString("azure.storageConnectionString", azure.storageConnectionString, 50, 500);
    }

    if (azure.tableName !== undefined) {
      this.validatePattern(
        "azure.tableName",
        azure.tableName,
        /^[A-Za-z][A-Za-z0-9]{2,62}$/,
        "must be a valid Azure table name"
      );
    }
  }

  private validateLimits(limits: any): void {
    if (limits.maxEmailsPerBatch !== undefined) {
      this.validateNumber("limits.maxEmailsPerBatch", limits.maxEmailsPerBatch, 1, 1000);
    }

    if (limits.maxProcessingTime !== undefined) {
      this.validateNumber("limits.maxProcessingTime", limits.maxProcessingTime, 1000, 900000); // 1s to 15min
    }

    if (limits.maxRetries !== undefined) {
      this.validateNumber("limits.maxRetries", limits.maxRetries, 0, 10);
    }
  }

  private validateApiKey(field: string, value: unknown): boolean {
    if (typeof value !== "string") {
      this.result.addError(field, "must be a string", value);
      return false;
    }

    if (value.length < 10) {
      this.result.addError(field, "appears to be invalid (too short)", value);
      return false;
    }

    // Check for common placeholder values
    const placeholders = ["your-api-key", "xxx", "todo", "placeholder", "<api-key>"];
    if (placeholders.some((p) => value.toLowerCase().includes(p))) {
      this.result.addError(field, "appears to be a placeholder value", value);
      return false;
    }

    return true;
  }
}