import { DevelopmentConfig } from "./DevelopmentConfig";
import type { IConfigStrategy } from "./IConfigStrategy";
import { ProductionConfig } from "./ProductionConfig";

/**
 * Configuration manager using Strategy pattern
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private strategy: IConfigStrategy;

  private constructor() {
    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
      process.env.AZURE_FUNCTIONS_ENVIRONMENT !== undefined;

    this.strategy = isProduction ? new ProductionConfig() : new DevelopmentConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  get config() {
    return {
      baseUrl: this.strategy.getBaseUrl(),
      apps: this.strategy.getApps(),
      aiKeywords: this.strategy.getAIKeywords(),
      storage: this.strategy.getStorageConfig(),
      email: this.strategy.getEmailConfig(),
      ai: this.strategy.getAIConfig(),
      limits: {
        maxEmailsPerBatch: this.strategy.getMaxEmailsPerBatch(),
        maxArticleFetchConcurrency: this.strategy.getMaxArticleFetchConcurrency(),
        articleFetchTimeout: this.strategy.getArticleFetchTimeout(),
      },
    };
  }

  /**
   * Override strategy for testing
   */
  setStrategy(strategy: IConfigStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get raw strategy for advanced use cases
   */
  getStrategy(): IConfigStrategy {
    return this.strategy;
  }
}
