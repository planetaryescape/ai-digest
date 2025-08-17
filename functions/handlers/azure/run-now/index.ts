import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * Azure Function handler for manual trigger
 * Makes an HTTP call to the weekly-digest function
 */
export default async function runNow(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.info(`Manual digest run triggered via HTTP - ${context.invocationId}`);

  try {
    // Get function key from environment
    const weeklyDigestKey = process.env.WEEKLY_DIGEST_KEY || "";

    // Construct the URL with the function key
    const functionHost = process.env.WEBSITE_HOSTNAME || "fn-ai-digest-unique.azurewebsites.net";
    const url = weeklyDigestKey
      ? `https://${functionHost}/api/weekly-digest?code=${weeklyDigestKey}`
      : `https://${functionHost}/api/weekly-digest`;

    // Make HTTP call to weekly-digest function
    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    context.info(`Calling weekly-digest function at ${url.replace(/code=.*/, "code=***")}`);

    const response = await fetch(url, options);
    const responseData = await response.text();

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(responseData);
    } catch {
      parsedResponse = { message: responseData };
    }

    context.info(`Weekly-digest response: ${response.status}`);

    // Return the response from weekly-digest
    return {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: response.ok,
        weeklyDigestResponse: parsedResponse,
        timestamp: new Date().toISOString(),
        invocationId: context.invocationId,
      }),
    };
  } catch (error) {
    context.error("Error in manual digest run", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to call weekly-digest function";

    return {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        invocationId: context.invocationId,
      }),
    };
  }
}
