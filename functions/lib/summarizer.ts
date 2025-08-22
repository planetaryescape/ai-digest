import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { config } from "./config";
import { getDomain } from "./extract";
import { type DigestOutput, DigestOutputSchema } from "./schemas/digest";
import type { EmailItem, Summary } from "./types";

/**
 * Truncate string to max length
 */
function truncate(str: string, maxLength: number): string {
  if (!str) {
    return "";
  }
  const cleaned = str.replace(/\s+/g, " ").trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned;
}

/**
 * Format email items into context for the AI
 */
function formatContext(items: EmailItem[]): string {
  const sections = items.slice(0, config.maxSections).map((item) => {
    const articles = item.articles
      .slice(0, 2)
      .map((article) => {
        const title = truncate(article.title || article.url, 120);
        const desc = truncate(article.desc || article.snippet || "", 280);
        const domain = getDomain(article.url);
        return `  - ${title} (${domain}) :: ${desc}`;
      })
      .join("\n");

    return `FROM: ${truncate(item.sender, 100)}\nSUBJECT: ${truncate(item.subject, 140)}\n${articles}`;
  });

  return sections.join("\n\n");
}

/**
 * Format product context for the prompt
 */
function formatProductContext(): string {
  const productCtx = config.getProductContext();
  return productCtx.apps
    .map((app) => {
      const keywords = app.keywords?.join(", ") || "";
      return `- ${app.name}${app.url ? ` (${app.url})` : ""}${app.desc ? ` — ${app.desc}` : ""}${keywords ? ` [keywords: ${keywords}]` : ""}`;
    })
    .join("\n");
}

/**
 * Format professions list
 */
function formatProfessions(): string {
  if (config.professions.length === 0) {
    return "(none)";
  }
  return config.professions.map((p) => `- ${p}`).join("\n");
}

/**
 * Main summarization function
 */
export async function summarize(items: EmailItem[]): Promise<Summary> {
  if (items.length === 0) {
    const emptyDigest: DigestOutput = {
      summaries: [],
      stats: {
        totalEmails: 0,
        aiEmails: 0,
        processedEmails: 0,
        totalCost: 0,
      },
      mode: "weekly",
      timestamp: new Date().toISOString(),
      headline: "No AI Updates This Week",
      summary: "No AI-related emails detected this week.",
      whatHappened: "No AI-related activity in your inbox this week.",
      takeaways: "Take a break and explore some AI resources on your own!",
      productPlays: [],
      tools: [],
      shortMessage: "Quiet week on AI in my inbox.",
      keyThemes: [],
      competitiveIntel: [],
    };
    return {
      digest: emptyDigest,
      message: "Quiet week on AI in my inbox.",
      items: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const context = formatContext(items);
  const productContext = formatProductContext();
  const professions = formatProfessions();

  try {
    const { object } = await generateObject({
      model: openai(config.openai.models.summarization), // Use smartest model for analysis
      mode: "json",
      schema: DigestOutputSchema,
      prompt: `You're writing for Bhekani - senior engineer, indie hacker, builds AI SaaS. Be direct. No fluff. No corporate speak.

NEWS:
${context}

MY ROLES: ${professions}
MY PRODUCTS: ${productContext}

Generate a digest with:

HEADLINE: One sentence. What's the actual big thing this week?

SUMMARY: 2-3 sentences max. What actually matters?

WHAT HAPPENED (whatHappened):
Extract the MOST IMPORTANT developments. For each:
- title: What actually happened (not the newsletter's clickbait title)
- source: Who reported it
- description: Why this matters in 1-2 sentences. Be specific.
- category: product/research/industry/tool/regulatory/business

Skip:
- Obvious stuff everyone knows
- Marketing announcements disguised as news
- Speculation without evidence
- Old news repackaged

TAKEAWAYS:
What should I actually DO based on this week's news?
- technical: Specific tech/tool to try NOW
- business: Opportunity to exploit THIS WEEK
- risk: Real threat to prepare for (not FUD)

Only include if there's a real action. No generic "stay informed" BS.

ROLE PLAYS (rolePlays):
For professions listed, ONLY if there's something they can use TODAY:
- Specific tool or technique
- Must be actionable this week
- No theoretical benefits

Skip roles without immediate plays.

PRODUCT PLAYS (productPlays):
Look at my products. Based on THIS WEEK'S news:
- What feature could ship in 1-2 days?
- What integration makes sense NOW?
- What positioning angle opened up?

Empty array if nothing concrete.

TOOLS:
New tools/APIs that actually work TODAY:
- Name and what it ACTUALLY does
- Specific use case for indie hackers
- Skip waitlists and "coming soon"

SHORT MESSAGE (shortMessage):
3-4 lines I can paste in Slack. Make it punchy:
- Lead with the most important thing
- Include 1-2 actionable items
- End with what to watch

KEY THEMES (keyThemes):
2-3 core patterns. Not buzzwords. What's actually shifting?

BE BASED:
- Call out hype vs reality
- Identify who's winning/losing
- Point out what everyone's missing
- If something's overhyped, say it
- If something's underrated, highlight it

NO:
- "Exciting developments"
- "Promising technology"
- "Worth monitoring"
- "Potential implications"
- Hedge words
- Corporate jargon

YES:
- "X launched Y, breaks Z"
- "This kills [competitor]"
- "Ship this feature now"
- "Ignore the hype about X"
- "Everyone's sleeping on Y"`,
    });

    return {
      digest: object,
      message: object.shortMessage || "Weekly AI digest generated",
      items,
      generatedAt: new Date().toISOString(),
    };
  } catch (_error) {
    // Fallback to basic summary
    return fallbackSummary(items);
  }
}

/**
 * Fallback summary if AI fails
 */
function fallbackSummary(items: EmailItem[]): Summary {
  const fallbackDigest: DigestOutput = {
    summaries: items.slice(0, 10).map((item) => ({
      title: item.subject,
      summary: item.snippet || "No summary available",
      sender: item.sender,
      date: item.date,
      category: "industry",
    })),
    stats: {
      totalEmails: items.length,
      aiEmails: items.length,
      processedEmails: items.length,
      totalCost: 0,
    },
    mode: "weekly",
    timestamp: new Date().toISOString(),
    headline: "Weekly AI Digest - Processing Error",
    summary: `Received ${items.length} AI-related emails this week. Unable to generate detailed analysis due to an error.`,
    whatHappened: "Processing error occurred. Manual review of emails recommended.",
    takeaways: "Review emails manually for important updates.",
    productPlays: [],
    tools: [],
    shortMessage: `${items.length} AI emails this week. Manual review recommended due to processing error.`,
    keyThemes: ["Processing Error - Manual Review Required"],
    competitiveIntel: [],
  };

  return {
    digest: fallbackDigest,
    message: fallbackDigest.shortMessage || "Weekly AI digest generated",
    items,
    generatedAt: new Date().toISOString(),
  };
}
