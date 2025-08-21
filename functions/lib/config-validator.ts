import { createLogger } from "./logger";

const log = createLogger("config-validator");

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Configuration validator to ensure all required environment variables are set
 */
export class ConfigValidator {
  private static requiredVars = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "OPENAI_API_KEY",
    "RESEND_API_KEY",
    "RECIPIENT_EMAIL",
  ];

  private static conditionalVars = {
    azure: ["AZURE_STORAGE_CONNECTION_STRING"],
    aws: ["AWS_REGION"],
    awsLambda: ["WEEKLY_DIGEST_FUNCTION_NAME"],
    dynamodb: ["DYNAMODB_TABLE_NAME"],
    s3: ["S3_BUCKET"],
  };

  private static optionalVars = [
    "HELICONE_API_KEY",
    "STORAGE_TYPE",
    "LOG_LEVEL",
    "OPENAI_MODEL",
    "MAX_TOKENS",
  ];

  /**
   * Validate configuration at startup
   */
  static validate(): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      missing: [],
      warnings: [],
    };

    // Check required variables
    for (const varName of ConfigValidator.requiredVars) {
      if (!process.env[varName]) {
        result.missing.push(varName);
        result.valid = false;
      }
    }

    // Check conditional variables based on deployment type
    if (ConfigValidator.isAzureEnvironment()) {
      for (const varName of ConfigValidator.conditionalVars.azure) {
        if (!process.env[varName]) {
          result.missing.push(varName);
          result.valid = false;
        }
      }
    }

    if (ConfigValidator.isAWSEnvironment()) {
      for (const varName of ConfigValidator.conditionalVars.aws) {
        if (!process.env[varName]) {
          result.warnings.push(`${varName} not set, using default`);
        }
      }

      // Check Lambda-specific vars if in Lambda environment
      if (ConfigValidator.isLambdaEnvironment()) {
        for (const varName of ConfigValidator.conditionalVars.awsLambda) {
          if (!process.env[varName] && varName === "WEEKLY_DIGEST_FUNCTION_NAME") {
            // Only required for run-now Lambda
            if (process.env.AWS_LAMBDA_FUNCTION_NAME?.includes("run-now")) {
              result.missing.push(varName);
              result.valid = false;
            }
          }
        }
      }

      // Check storage-specific vars
      const storageType = process.env.STORAGE_TYPE?.toLowerCase();
      if (storageType === "dynamodb") {
        for (const varName of ConfigValidator.conditionalVars.dynamodb) {
          if (!process.env[varName]) {
            result.warnings.push(`${varName} not set for DynamoDB storage`);
          }
        }
      } else if (storageType === "s3") {
        for (const varName of ConfigValidator.conditionalVars.s3) {
          if (!process.env[varName]) {
            result.missing.push(varName);
            result.valid = false;
          }
        }
      }
    }

    // Check for optional variables and provide warnings
    for (const varName of ConfigValidator.optionalVars) {
      if (!process.env[varName]) {
        result.warnings.push(`Optional: ${varName} not set`);
      }
    }

    return result;
  }

  /**
   * Validate and throw on failure
   */
  static validateOrThrow(): void {
    const result = ConfigValidator.validate();

    if (!result.valid) {
      const errorMessage = `Configuration validation failed!\n\nMissing required environment variables:\n${result.missing
        .map((v) => `  - ${v}`)
        .join("\n")}\n\nPlease set these variables before starting the application.`;

      log.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (result.warnings.length > 0) {
      log.warn("Configuration warnings: " + result.warnings.join(", "));
    } else {
      log.info("Configuration validation passed ✅");
    }
  }

  /**
   * Get configuration report
   */
  static getReport(): string {
    const result = ConfigValidator.validate();
    const lines: string[] = ["Configuration Report", "=".repeat(50)];

    if (result.valid) {
      lines.push("✅ All required variables are set");
    } else {
      lines.push("❌ Configuration is invalid");
      lines.push("\nMissing required variables:");
      for (const varName of result.missing) {
        lines.push(`  - ${varName}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push("\n⚠️  Warnings:");
      for (const warning of result.warnings) {
        lines.push(`  - ${warning}`);
      }
    }

    lines.push("\nEnvironment Detection:");
    lines.push(`  - Azure: ${ConfigValidator.isAzureEnvironment() ? "Yes" : "No"}`);
    lines.push(`  - AWS: ${ConfigValidator.isAWSEnvironment() ? "Yes" : "No"}`);
    lines.push(`  - Lambda: ${ConfigValidator.isLambdaEnvironment() ? "Yes" : "No"}`);
    lines.push(`  - Storage Type: ${process.env.STORAGE_TYPE || "auto-detect"}`);

    return lines.join("\n");
  }

  /**
   * Check if running in Azure environment
   */
  private static isAzureEnvironment(): boolean {
    return !!(
      process.env.AZURE_STORAGE_CONNECTION_STRING ||
      process.env.WEBSITE_INSTANCE_ID ||
      process.env.AZURE_FUNCTIONS_ENVIRONMENT
    );
  }

  /**
   * Check if running in AWS environment
   */
  private static isAWSEnvironment(): boolean {
    return !!(
      process.env.AWS_REGION ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      (!ConfigValidator.isAzureEnvironment() && !process.env.AZURE_STORAGE_CONNECTION_STRING)
    );
  }

  /**
   * Check if running in Lambda environment
   */
  private static isLambdaEnvironment(): boolean {
    return !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
  }

  /**
   * Get masked value for sensitive variables
   */
  static getMaskedValue(varName: string): string {
    const value = process.env[varName];
    if (!value) return "NOT_SET";

    const sensitiveVars = [
      "GMAIL_CLIENT_SECRET",
      "GMAIL_REFRESH_TOKEN",
      "OPENAI_API_KEY",
      "RESEND_API_KEY",
      "AZURE_STORAGE_CONNECTION_STRING",
      "HELICONE_API_KEY",
    ];

    if (sensitiveVars.includes(varName)) {
      if (value.length <= 8) {
        return "*".repeat(value.length);
      }
      return `${value.substring(0, 4)}...****`;
    }

    return value;
  }
}
