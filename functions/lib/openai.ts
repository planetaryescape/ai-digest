import { createOpenAI } from "@ai-sdk/openai";
import { config } from "./config";

/**
 * Get the current week number for caching
 */
function getWeekNumber(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Create OpenAI client with Helicone wrapper for observability
 */
export function getOpenAIClient(context?: string) {
  const headers: Record<string, string> = {
    "Helicone-Auth": `Bearer ${config.openai.heliconeKey}`,
    "Helicone-Cache-Enabled": "true",
    "Helicone-Property-App": "ai-digest",
    "Helicone-Property-Environment": process.env.NODE_ENV || "production",
    "Helicone-Property-Week": getWeekNumber(),
  };

  if (context) {
    headers["Helicone-Property-Context"] = context;
  }

  return createOpenAI({
    apiKey: config.openai.apiKey,
    baseURL: "https://oai.helicone.ai/v1",
    headers,
  });
}

/**
 * Get OpenAI client for summarization with caching
 */
export function getSummarizerClient() {
  return getOpenAIClient("summarizer");
}
