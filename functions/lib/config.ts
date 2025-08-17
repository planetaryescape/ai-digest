import { ConfigManager } from "./config/ConfigManager";
import type { ProductContext } from "./types";

const domain = process.env.DOMAIN || "ai-digest.bhekani.com";

// Get configuration from ConfigManager
const configManager = ConfigManager.getInstance();
const managedConfig = configManager.config;

/**
 * Main configuration object
 * Maintains backward compatibility while using Strategy pattern internally
 */
export const config = {
  projectName: "AI Digest",
  baseUrl: managedConfig.baseUrl,
  domain,
  supportEmail: "digest@bhekani.com",

  // Your apps for product plays
  apps: [
    {
      name: "Interview Optimiser",
      url: "https://interviewoptimiser.com",
      desc: "Mock interviews, feedback & coaching for job seekers",
      keywords: [
        "interview",
        "recruiting",
        "hiring",
        "coaching",
        "career",
        "job search",
      ],
    },
    {
      name: "CV Optimiser",
      url: "https://cvoptimiser.com",
      desc: "AI-powered CV optimization with ATS compatibility",
      keywords: ["resume", "cv", "job", "career", "ats", "application"],
    },
    {
      name: "Reference Optimiser",
      url: "https://referenceoptimiser.com",
      desc: "Professional reference letter generation",
      keywords: ["reference", "recommendation", "letter", "testimonial"],
    },
    {
      name: "Dealbase",
      url: "https://dealbase.com",
      desc: "AI-extracted startup funding database",
      keywords: [
        "funding",
        "investment",
        "startup",
        "venture",
        "capital",
        "fundraising",
      ],
    },
    {
      name: "Blog",
      url: "https://bhekani.com",
      desc: "Technical, AI & indie hacking content",
      keywords: ["content", "seo", "marketing", "writing", "blog", "technical"],
    },
  ],

  // AI detection keywords (from ConfigManager)
  aiKeywords: managedConfig.aiKeywords,

  // Cost control settings
  maxSections: Number(process.env.MAX_SECTIONS || "25"),
  maxLinksPerEmail: Number(process.env.MAX_LINKS_PER_EMAIL || "2"),
  maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || "2000"),
  olderThanDays: Number(process.env.OLDER_THAN_DAYS || "30"),

  // Professional roles for advice generation
  professions: (
    process.env.PROFESSIONS ||
    "Software Engineer,ML Engineer,Data Scientist,Product Manager,Designer,Founder,Investor,Researcher,DevOps Engineer,Security Engineer,Content Creator,Marketer"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Branding colors (matching your other apps)
  brand: {
    primary: "hsl(228 73% 13%)",
    offwhite: "hsl(210 36% 96%)",
    accent: "hsl(217 91% 60%)",
    success: "hsl(142 71% 45%)",
    warning: "hsl(38 92% 50%)",
    error: "hsl(0 84% 60%)",
  },

  // Email settings (from ConfigManager)
  email: {
    from: process.env.RESEND_FROM || "AI Digest <ai-digest@journaler.me>",
    recipient: managedConfig.email.recipientEmail,
    subject: "Weekly AI Digest - What Matters This Week",
  },

  // OpenAI settings (from ConfigManager)
  openai: {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini", // Default for most tasks
    apiKey: managedConfig.ai.openAIKey,
    heliconeKey: managedConfig.ai.heliconeKey || "",
    // Model tiers for different tasks
    models: {
      classification: process.env.CLASSIFICATION_MODEL || "gpt-4o-mini", // Fast classification
      extraction: process.env.EXTRACTION_MODEL || "gpt-4o-mini", // Basic extraction
      summarization: process.env.SUMMARIZATION_MODEL || "gpt-4o", // Smart analysis & opinions
      analysis: process.env.ANALYSIS_MODEL || "gpt-4o", // Critical thinking & opinions
      default: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
  },

  // Gmail settings (from ConfigManager)
  gmail: {
    clientId: managedConfig.email.clientId,
    clientSecret: managedConfig.email.clientSecret,
    refreshToken: managedConfig.email.refreshToken,
  },

  // Resend settings
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
  },

  // Azure Storage settings
  azure: {
    storageConnectionString: managedConfig.storage.connectionString || "",
    tableName: "ProcessedEmails",
  },

  // Additional keywords from environment
  additionalKeywords: (process.env.KEYWORDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  // Limits from ConfigManager
  limits: managedConfig.limits,

  // Product context for AI
  getProductContext(): ProductContext {
    try {
      const envContext = process.env.PRODUCT_CONTEXT;
      if (envContext) {
        return JSON.parse(envContext);
      }
    } catch (_e) {
      // Ignore parse errors and use default context
    }

    // Default context
    return {
      owner: "Bhekani",
      apps: config.apps,
    };
  },

  // Source quality scores (0-1, higher is better)
  sourceScores: {
    // Official sources
    "openai.com": 0.95,
    "anthropic.com": 0.95,
    "deepmind.com": 0.95,
    "huggingface.co": 0.9,
    "mistral.ai": 0.9,

    // News & analysis
    "techcrunch.com": 0.75,
    "theverge.com": 0.7,
    "wired.com": 0.75,
    "arstechnica.com": 0.8,
    "venturebeat.com": 0.7,
    "thenextweb.com": 0.65,

    // AI-focused publications
    "theinformation.com": 0.85,
    "stratechery.com": 0.9,
    "bensbites.com": 0.8,
    "thesequence.substack.com": 0.8,

    // Research
    "arxiv.org": 0.9,
    "papers.ssrn.com": 0.85,

    // Platforms
    "github.com": 0.85,
    "producthunt.com": 0.7,
    "ycombinator.com": 0.8,

    // Default for unknown sources
    default: 0.5,
  } as Record<string, number>,

  // Get quality score for a source
  getSourceScore(domain: string): number {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, "");
    return config.sourceScores[cleanDomain] || config.sourceScores.default;
  },
};

// Export ConfigManager for advanced use cases
export { ConfigManager };
