import type { APIGatewayProxyHandler } from "aws-lambda";
import { GmailClient } from "../../lib/gmail";
import { createLogger } from "../../lib/logger";

const log = createLogger("gmail-health");

/**
 * Health check endpoint for Gmail API access
 * Returns token status and validates Gmail connectivity
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  log.info({ method: event.httpMethod }, "Gmail health check requested");

  try {
    const client = new GmailClient();
    
    // Get current token status
    const tokenStatus = client.getTokenStatus();
    
    // Attempt to validate access
    const validationResult = await client.validateAccess();
    
    const response = {
      status: validationResult.isOk() ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      token: {
        valid: tokenStatus.hasValidToken,
        expiresIn: tokenStatus.expiresIn ? Math.floor(tokenStatus.expiresIn / 1000) : null,
        expiresInHuman: tokenStatus.expiresIn 
          ? `${Math.floor(tokenStatus.expiresIn / 1000 / 60)} minutes`
          : null,
        refreshAttempts: tokenStatus.refreshAttempts,
        lastRefreshAttempt: tokenStatus.lastRefreshAttempt?.toISOString() || null,
      },
      validation: {
        success: validationResult.isOk(),
        error: validationResult.isErr() ? validationResult.error : null,
      },
      recommendation: getRecommendation(validationResult.isOk(), tokenStatus),
    };

    const statusCode = validationResult.isOk() ? 200 : 503;

    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(response, null, 2),
    };
  } catch (error) {
    log.error({ error }, "Health check failed");
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        recommendation: "Check logs for details. May need to regenerate refresh token.",
      }, null, 2),
    };
  }
};

function getRecommendation(isValid: boolean, tokenStatus: any): string {
  if (!isValid) {
    if (tokenStatus.refreshAttempts >= 3) {
      return "Token refresh attempts exhausted. Run 'bun run generate:oauth' to get a new refresh token.";
    }
    return "Gmail access is unhealthy. Token may need to be refreshed or regenerated.";
  }
  
  if (tokenStatus.expiresIn && tokenStatus.expiresIn < 600000) { // Less than 10 minutes
    return "Token expiring soon. Will be automatically refreshed on next use.";
  }
  
  return "Gmail access is healthy and token is valid.";
}