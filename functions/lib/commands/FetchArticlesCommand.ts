import { ConfigManager } from "../config/ConfigManager";
import { fetchArticleData } from "../extract";
import { createLogger } from "../logger";
import type { EmailItem } from "../types";
import type { CommandResult, IEmailCommand } from "./IEmailCommand";

export interface ArticleData {
  url: string;
  title?: string;
  content?: string;
  error?: string;
}

export class FetchArticlesCommand implements IEmailCommand<ArticleData[]> {
  private logger = createLogger("FetchArticlesCommand");
  private config = ConfigManager.getInstance().config;
  private urls: string[];

  constructor(urls: string[]) {
    this.urls = urls;
  }

  getName(): string {
    return "FetchArticles";
  }

  canExecute(_email: EmailItem): boolean {
    return this.urls.length > 0;
  }

  async execute(email: EmailItem): Promise<CommandResult<ArticleData[]>> {
    try {
      if (!this.canExecute(email)) {
        return {
          success: true,
          data: [],
          metadata: {
            emailId: email.id,
            articleCount: 0,
          },
        };
      }

      const maxConcurrency = this.config.limits.maxArticleFetchConcurrency;
      const timeout = this.config.limits.articleFetchTimeout;

      const articles = await this.fetchWithConcurrencyLimit(this.urls, maxConcurrency, timeout);

      const successCount = articles.filter((a) => !a.error).length;
      this.logger.info(
        `Fetched ${successCount}/${this.urls.length} articles for email ${email.id}`
      );

      return {
        success: true,
        data: articles,
        metadata: {
          emailId: email.id,
          articleCount: articles.length,
          successCount,
          failureCount: articles.length - successCount,
        },
      };
    } catch (error) {
      this.logger.error({ error }, `Failed to fetch articles for email ${email.id}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch articles",
      };
    }
  }

  private async fetchWithConcurrencyLimit(
    urls: string[],
    maxConcurrency: number,
    timeout: number
  ): Promise<ArticleData[]> {
    const results: ArticleData[] = [];
    const chunks = this.chunkArray(urls, maxConcurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((url) => this.fetchSingleArticle(url, timeout))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  private async fetchSingleArticle(url: string, timeout: number): Promise<ArticleData> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const article = await fetchArticleData(url);
      clearTimeout(timeoutId);

      return {
        url,
        title: article?.title,
        content: article?.desc || article?.snippet,
      };
    } catch (error) {
      return {
        url,
        error: error instanceof Error ? error.message : "Failed to fetch",
      };
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
