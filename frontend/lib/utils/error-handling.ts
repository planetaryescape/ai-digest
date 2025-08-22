/**
 * Sanitize error messages to prevent leaking sensitive information
 */
export function sanitizeError(error: unknown): string {
  // In production, return generic error messages
  if (process.env.NODE_ENV === "production") {
    if (error instanceof Error) {
      // Common AWS errors that are safe to expose
      if (error.message.includes("not configured")) {
        return "Service not configured";
      }
      if (error.message.includes("Unauthorized") || error.message.includes("AccessDenied")) {
        return "Access denied";
      }
      if (error.message.includes("ResourceNotFound")) {
        return "Resource not found";
      }
      if (error.message.includes("ValidationException")) {
        return "Invalid request parameters";
      }
    }
    return "An error occurred processing your request";
  }

  // In development, return full error details
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T | null = null): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
