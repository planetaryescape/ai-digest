import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { createLogger } from "../logger";
import { Result } from "../types/Result";

const log = createLogger("gmail-token-manager");

export interface TokenConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface TokenInfo {
  accessToken: string;
  expiryDate: number;
  refreshToken: string;
}

export class GmailTokenManager {
  private oauth2Client: OAuth2Client;
  private tokenConfig: TokenConfig;
  private lastRefreshAttempt: number = 0;
  private refreshAttemptCount: number = 0;
  private readonly MAX_REFRESH_ATTEMPTS = 3;
  private readonly REFRESH_COOLDOWN_MS = 60000; // 1 minute between refresh attempts
  private tokenCache: TokenInfo | null = null;

  constructor(config: TokenConfig) {
    this.tokenConfig = config;
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      "urn:ietf:wg:oauth:2.0:oob"
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken,
    });
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken(): Promise<Result<string>> {
    try {
      // Check if we have a cached token that's still valid
      if (this.tokenCache && this.isTokenValid(this.tokenCache)) {
        log.debug("Using cached access token");
        return Result.ok(this.tokenCache.accessToken);
      }

      // Try to get current token info
      const currentToken = await this.oauth2Client.getAccessToken();
      
      if (currentToken.token) {
        // Cache the token info
        this.tokenCache = {
          accessToken: currentToken.token,
          expiryDate: this.oauth2Client.credentials.expiry_date || Date.now() + 3600000,
          refreshToken: this.tokenConfig.refreshToken,
        };

        // Check if token needs refresh (expires in less than 5 minutes)
        if (this.shouldRefreshToken(this.tokenCache)) {
          log.info("Access token expiring soon, refreshing proactively");
          return this.refreshAccessToken();
        }

        return Result.ok(currentToken.token);
      }

      // No token available, try to refresh
      return this.refreshAccessToken();
    } catch (error) {
      log.error({ error }, "Failed to get valid access token");
      return this.handleTokenError(error);
    }
  }

  /**
   * Force refresh the access token
   */
  async refreshAccessToken(): Promise<Result<string>> {
    // Check cooldown period
    const now = Date.now();
    if (now - this.lastRefreshAttempt < this.REFRESH_COOLDOWN_MS) {
      const waitTime = this.REFRESH_COOLDOWN_MS - (now - this.lastRefreshAttempt);
      log.warn(`Token refresh on cooldown, waiting ${waitTime}ms`);
      await this.delay(waitTime);
    }

    this.lastRefreshAttempt = now;
    this.refreshAttemptCount++;

    if (this.refreshAttemptCount > this.MAX_REFRESH_ATTEMPTS) {
      return Result.fail({
        code: "TOKEN_REFRESH_LIMIT_EXCEEDED",
        message: "Maximum token refresh attempts exceeded. Manual intervention required.",
      });
    }

    try {
      log.info("Refreshing Gmail access token");
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error("No access token received after refresh");
      }

      // Update cache
      this.tokenCache = {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date || Date.now() + 3600000,
        refreshToken: credentials.refresh_token || this.tokenConfig.refreshToken,
      };

      // Update refresh token if a new one was provided
      if (credentials.refresh_token && credentials.refresh_token !== this.tokenConfig.refreshToken) {
        log.info("New refresh token received, updating configuration");
        this.tokenConfig.refreshToken = credentials.refresh_token;
        this.oauth2Client.setCredentials({
          refresh_token: credentials.refresh_token,
        });
      }

      // Reset attempt counter on success
      this.refreshAttemptCount = 0;
      
      log.info("Successfully refreshed Gmail access token");
      return Result.ok(credentials.access_token);
    } catch (error) {
      log.error({ error }, "Failed to refresh access token");
      return this.handleTokenError(error);
    }
  }

  /**
   * Validate the current token by making a test API call
   */
  async validateToken(): Promise<Result<boolean>> {
    try {
      const tokenResult = await this.getValidAccessToken();
      if (tokenResult.isErr()) {
        return Result.fail(tokenResult.error);
      }

      // Make a simple API call to validate the token
      const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
      await gmail.users.getProfile({ userId: "me" });
      
      log.info("Token validation successful");
      return Result.ok(true);
    } catch (error: any) {
      log.error({ error }, "Token validation failed");
      
      if (error.code === 401 || error.message?.includes("invalid_grant")) {
        return Result.fail({
          code: "INVALID_TOKEN",
          message: "Gmail refresh token is invalid or expired. Please regenerate it.",
        });
      }
      
      return Result.fail({
        code: "VALIDATION_ERROR",
        message: error.message || "Token validation failed",
      });
    }
  }

  /**
   * Get the OAuth2 client for Gmail API usage
   */
  getOAuth2Client(): OAuth2Client {
    return this.oauth2Client;
  }

  /**
   * Check if a token is still valid
   */
  private isTokenValid(token: TokenInfo): boolean {
    // Consider token invalid if it expires in less than 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return token.expiryDate > Date.now() + bufferTime;
  }

  /**
   * Check if token should be refreshed
   */
  private shouldRefreshToken(token: TokenInfo): boolean {
    // Refresh if token expires in less than 10 minutes
    const refreshThreshold = 10 * 60 * 1000; // 10 minutes
    return token.expiryDate < Date.now() + refreshThreshold;
  }

  /**
   * Handle token-related errors
   */
  private handleTokenError(error: any): Result<string> {
    const errorMessage = error.message || "Unknown error";
    
    if (errorMessage.includes("invalid_grant")) {
      return Result.fail({
        code: "INVALID_REFRESH_TOKEN",
        message: "Gmail refresh token is invalid or expired. Please run 'bun run generate:oauth' to get a new token.",
      });
    }
    
    if (errorMessage.includes("invalid_client")) {
      return Result.fail({
        code: "INVALID_CLIENT_CREDENTIALS",
        message: "Gmail OAuth client credentials are invalid. Please check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.",
      });
    }
    
    if (error.code === 401) {
      return Result.fail({
        code: "UNAUTHORIZED",
        message: "Gmail API authentication failed. Token may be expired.",
      });
    }
    
    if (error.code === 403) {
      return Result.fail({
        code: "FORBIDDEN",
        message: "Gmail API access forbidden. Check API permissions and quotas.",
      });
    }
    
    return Result.fail({
      code: "TOKEN_ERROR",
      message: errorMessage,
    });
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current token status for monitoring
   */
  getTokenStatus(): {
    hasValidToken: boolean;
    expiresIn: number | null;
    refreshAttempts: number;
    lastRefreshAttempt: Date | null;
  } {
    const hasValidToken = this.tokenCache ? this.isTokenValid(this.tokenCache) : false;
    const expiresIn = this.tokenCache 
      ? Math.max(0, this.tokenCache.expiryDate - Date.now()) 
      : null;
    
    return {
      hasValidToken,
      expiresIn,
      refreshAttempts: this.refreshAttemptCount,
      lastRefreshAttempt: this.lastRefreshAttempt 
        ? new Date(this.lastRefreshAttempt) 
        : null,
    };
  }
}