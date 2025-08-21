import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { load } from "cheerio";
import type { gmail_v1 } from "googleapis";
import { z } from "zod";
import { config } from "./config";
import { createLogger } from "./logger";
import type { Article } from "./types";

const log = createLogger("extract");

const URL_REGEX = /https?:\/\/[^\s<>"\])]+/gi;

/**
 * Extract URLs from email body parts
 */
export function extractUrlsFromEmail(payload: gmail_v1.Schema$MessagePart | undefined): string[] {
  if (!payload) {
    return [];
  }

  const urls: string[] = [];

  function walkParts(part: gmail_v1.Schema$MessagePart) {
    // Check if this part has body data
    if (part.body?.data) {
      const mimeType = part.mimeType || "";
      if (mimeType.includes("text/plain") || mimeType.includes("text/html")) {
        try {
          // Decode base64url encoded data
          const decoded = Buffer.from(part.body.data, "base64url").toString("utf-8");
          const foundUrls = decoded.match(URL_REGEX) || [];
          urls.push(...foundUrls);
        } catch (_error) {
          log.debug("Error decoding base64url encoded data");
        }
      }
    }

    // Recursively walk nested parts
    if (part.parts) {
      for (const subPart of part.parts) {
        walkParts(subPart);
      }
    }
  }

  walkParts(payload);

  // Clean and deduplicate URLs
  const cleanedUrls = urls
    .map((url) => url.trim().replace(/[)>.,]+$/, "")) // Remove trailing punctuation
    .filter((url) => {
      const lower = url.toLowerCase();

      // Filter out unsubscribe and preference links
      if (
        lower.includes("unsubscribe") ||
        lower.includes("/u/") ||
        lower.includes("mailto:") ||
        lower.includes("preferences") ||
        lower.includes("manage-subscription") ||
        lower.includes("email-settings")
      ) {
        return false;
      }

      // Filter out images, icons, and static assets
      if (
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".png") ||
        lower.endsWith(".gif") ||
        lower.endsWith(".svg") ||
        lower.endsWith(".webp") ||
        lower.endsWith(".ico") ||
        lower.includes("/favicon") ||
        lower.includes("/images/") ||
        lower.includes("/img/") ||
        lower.includes("/static/") ||
        lower.includes("/assets/") ||
        lower.includes("responsysimages") || // Qatar Airways email tracking images
        lower.includes("tracking.") ||
        lower.includes("pixel.") ||
        lower.includes("/track/") ||
        lower.includes("/beacon/")
      ) {
        return false;
      }

      // Filter out CSS and JS files
      if (
        lower.endsWith(".css") ||
        lower.endsWith(".js") ||
        lower.endsWith(".woff") ||
        lower.endsWith(".woff2") ||
        lower.endsWith(".ttf") ||
        lower.endsWith(".eot")
      ) {
        return false;
      }

      return true;
    });

  // Deduplicate
  return [...new Set(cleanedUrls)];
}

/**
 * Fetch HTML content from URL with timeout and retries
 */
async function fetchHtml(url: string, timeout: number = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIDigestBot/1.0; +https://ai-digest.bhekani.com)",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return html;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      log.debug({ url }, "Fetch timed out");
    } else {
      log.debug(
        { url, error: error instanceof Error ? error.message : String(error) },
        "Error fetching HTML"
      );
    }

    return null;
  }
}

/**
 * Extract metadata from HTML
 */
function extractMetadata(html: string): {
  title?: string;
  desc?: string;
  snippet: string;
} {
  const $ = load(html);

  // Extract title
  const title =
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim();

  // Extract description
  const desc =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="twitter:description"]').attr("content")?.trim();

  // Extract text snippet (first 1200 chars of body text)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const snippet = bodyText.slice(0, 1200);

  return { title, desc, snippet };
}

/**
 * Get domain from URL
 */
export function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Fetch article data from URL
 */
export async function fetchArticleData(url: string): Promise<Article | null> {
  try {
    const html = await fetchHtml(url);

    if (!html) {
      // Return basic article with just URL if fetch fails
      return { url };
    }

    const metadata = extractMetadata(html);

    return {
      url,
      title: metadata.title,
      desc: metadata.desc,
      snippet: metadata.snippet,
    };
  } catch (_error) {
    return { url };
  }
}

/**
 * Batch fetch articles with concurrency limit
 */
export async function batchFetchArticles(
  urls: string[],
  concurrency: number = 3
): Promise<Article[]> {
  const results: Article[] = [];

  // Process URLs in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((url) => fetchArticleData(url)));
    results.push(...(batchResults.filter((r) => r !== null) as Article[]));
  }

  return results;
}

/**
 * Schema for AI-enhanced article insights
 */
const ArticleInsightSchema = z.object({
  mainPoint: z.string().describe("Core thesis in one sentence"),
  relevanceToAI: z.string().describe("How this relates to AI/ML"),
  keyInsight: z.string().describe("Non-obvious insight or implication"),
  actionableAdvice: z.string().optional().describe("What action to take based on this"),
});

/**
 * Enhanced article data extraction with AI insights
 */
export async function enhancedExtractArticleData(
  url: string,
  useAI: boolean = true
): Promise<Article | null> {
  try {
    // Get basic article data first
    const basicData = await fetchArticleData(url);
    if (!basicData || !basicData.snippet || !useAI) {
      return basicData;
    }

    // Skip AI enhancement for very short snippets
    if (basicData.snippet.length < 200) {
      return basicData;
    }

    try {
      // Use AI to extract key insights
      const { object: insights } = await generateObject({
        model: openai(config.openai.models.extraction), // Use o4-mini for smart extraction
        schema: ArticleInsightSchema,
        prompt: `Extract key information from this article:
URL: ${url}
Title: ${basicData.title || "Unknown"}
Content: ${basicData.snippet.slice(0, 800)}

Focus on:
1. The main point being made
2. How this relates to AI/ML/tech
3. Any non-obvious insight or implication
4. Actionable advice for developers/entrepreneurs

Be concise and specific.`,
      });

      // Enhance the article data with AI insights
      return {
        ...basicData,
        aiSummary: {
          mainPoint: insights.mainPoint,
          relevanceToAI: insights.relevanceToAI,
          keyInsight: insights.keyInsight,
          actionableAdvice: insights.actionableAdvice,
        },
      };
    } catch (aiError) {
      log.debug({ url, error: aiError }, "AI enhancement failed, returning basic data");
      return basicData;
    }
  } catch (error) {
    log.debug({ url, error }, "Enhanced extraction failed");
    return { url };
  }
}

/**
 * Batch fetch articles with AI enhancement
 */
export async function batchFetchArticlesEnhanced(
  urls: string[],
  concurrency: number = 2,
  useAI: boolean = true
): Promise<Article[]> {
  const results: Article[] = [];

  // Process URLs in batches with lower concurrency for AI calls
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => enhancedExtractArticleData(url, useAI))
    );
    results.push(...(batchResults.filter((r) => r !== null) as Article[]));
  }

  return results;
}
