import type { HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { createAzureHandler } from "../../unified/AzureHandler";

/**
 * Azure Function handler for weekly digest
 * Can be triggered by timer or HTTP
 * Uses unified handler architecture
 */
const handler = createAzureHandler();

export default function weeklyDigest(
  myTimer: Timer | HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit | undefined> {
  return handler(myTimer, context);
}
