#!/usr/bin/env bun

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { renderAsync } from "@react-email/render";
import React from "react";
import { WeeklyDigestEmail } from "../emails/WeeklyDigestRedesigned";
import type { DigestOutput } from "../functions/lib/schemas/digest";
import type { Summary } from "../functions/lib/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const exampleDigest: DigestOutput = {
  headline: "AI Breakthrough Week: From GPT-5 Rumors to Real-World Applications",
  summary:
    "This week brought significant developments in AI capabilities. Major tech companies unveiled new reasoning models, while practical implementations in enterprise software show AI moving from experimental to essential. The focus shifts from raw performance to real-world utility.",
  keyThemes: ["Enterprise AI", "Model Efficiency", "Open Source AI", "AI Safety"],
  competitiveIntel: [
    {
      insight: "Meta's Llama 3.2 matches GPT-4 on most benchmarks while being fully open",
      players: ["Meta", "OpenAI", "Anthropic"],
      implication: "Open source is closing the gap faster than expected",
    },
    {
      insight: "Microsoft integrates AI into entire Office suite with Copilot Pro",
      players: ["Microsoft", "Google", "Notion"],
      implication: "AI productivity tools becoming mandatory for knowledge workers",
    },
  ],
  whatHappened: [
    {
      title: "Anthropic Launches Claude 3.5 with 200K Context",
      source: "TechCrunch",
      category: "AI Models",
      description:
        "New model handles entire codebases in a single prompt, enabling unprecedented code analysis and refactoring capabilities.",
    },
    {
      title: "GitHub Copilot Reaches 1.8M Paid Subscribers",
      source: "GitHub Blog",
      category: "Developer Tools",
      description:
        "37% year-over-year growth shows AI coding assistants becoming standard development tools.",
    },
    {
      title: "Perplexity Valued at $9B After Latest Funding",
      source: "Reuters",
      category: "AI Search",
      description:
        "AI-powered search engine raises $500M, challenging Google's dominance with conversational search.",
    },
  ],
  takeaways: [
    {
      title: "Context Windows Are The New Battleground",
      description:
        "Models with 1M+ token contexts enable entirely new use cases. Build apps that leverage this capability before competitors do.",
      category: "technical",
      actionable: true,
    },
    {
      title: "AI Cost Optimization Becomes Critical",
      description:
        "With usage scaling, the difference between $0.01 and $0.001 per request impacts profitability. Optimize model selection and caching strategies.",
      category: "business",
      actionable: true,
    },
    {
      title: "Multimodal Is Now Table Stakes",
      description:
        "Users expect AI that understands text, images, and code seamlessly. Single-mode AI products are becoming obsolete.",
      category: "risk",
      actionable: false,
    },
  ],
  productPlays: [
    {
      appName: "Your Product",
      feature: "Smart Documentation Search",
      description:
        "Use vector embeddings to let users search docs with natural language queries, finding answers they didn't know existed.",
      effort: "quick-win",
      impact: "high",
    },
    {
      appName: "Your Platform",
      feature: "AI-Powered Data Analysis",
      description:
        "Let users ask questions about their data in plain English and get visualizations automatically generated.",
      effort: "1-2-weeks",
      impact: "high",
    },
  ],
  summaries: [
    {
      title: "The State of AI: Q4 2024 Report",
      summary:
        "Comprehensive analysis of AI industry trends, showing shift from research to implementation phase with enterprises leading adoption.",
      keyInsights: [
        "80% of Fortune 500 now using AI in production",
        "ROI averaging 3.5x within first year",
        "Skills gap remains biggest barrier",
      ],
      whyItMatters: "AI adoption crossing the chasm from early adopters to mainstream",
      actionItems: [
        "Audit your AI strategy",
        "Invest in team training",
        "Start with pilot projects",
      ],
      category: "Industry Analysis",
      sender: "newsletter@example-ai.com",
      date: new Date().toISOString(),
    },
    {
      title: "Building Production-Ready RAG Systems",
      summary:
        "Technical deep-dive into retrieval-augmented generation, covering vector databases, chunking strategies, and evaluation metrics.",
      keyInsights: [
        "Hybrid search outperforms pure vector search",
        "Chunk size dramatically impacts accuracy",
        "Reranking models improve relevance by 40%",
      ],
      whyItMatters: "RAG is becoming the standard architecture for AI applications",
      actionItems: ["Implement hybrid search", "Test different chunking strategies"],
      category: "Technical",
      sender: "tech-digest@example.com",
      date: new Date().toISOString(),
    },
    {
      title: "AI Regulation Update: EU AI Act Implementation",
      summary:
        "European Union begins enforcing AI Act provisions, requiring transparency and risk assessments for AI systems.",
      keyInsights: [
        "High-risk AI systems need compliance by 2025",
        "Transparency requirements for all AI interactions",
        "Penalties up to 7% of global revenue",
      ],
      whyItMatters: "Regulatory compliance becoming mandatory for AI products in EU markets",
      actionItems: ["Review AI Act requirements", "Document AI decision processes"],
      category: "Regulation",
      sender: "legal-updates@ai-news.com",
      date: new Date().toISOString(),
    },
    {
      title: "Voice AI Revolution: Beyond ChatGPT Voice",
      summary:
        "New voice models achieve human parity in conversation, enabling natural interactions for customer service and personal assistants.",
      keyInsights: [
        "Sub-100ms latency achieved",
        "Emotional intelligence in responses",
        "Voice cloning with 3 seconds of audio",
      ],
      whyItMatters: "Voice becoming the primary interface for AI interactions",
      actionItems: ["Prototype voice interfaces", "Consider voice-first design"],
      category: "Voice Tech",
      sender: "innovations@voice-ai.com",
      date: new Date().toISOString(),
    },
    {
      title: "Open Source AI: Llama 3.2 Changes Everything",
      summary:
        "Meta's latest model brings GPT-4 level performance to open source, enabling on-premise deployment and full customization.",
      keyInsights: [
        "70B parameter model fits on single GPU",
        "Fine-tuning in hours, not days",
        "No API costs or rate limits",
      ],
      whyItMatters: "Enterprises can now run state-of-the-art AI without vendor dependencies",
      actionItems: ["Test Llama 3.2 for your use cases", "Evaluate on-premise deployment"],
      category: "Open Source",
      sender: "oss-weekly@example.org",
      date: new Date().toISOString(),
    },
  ],
  stats: {
    totalEmails: 237,
    aiEmails: 89,
    processedEmails: 89,
    totalCost: 0.18,
  },
  mode: "weekly",
  timestamp: new Date().toISOString(),
};

const exampleSummary: Summary = {
  title: "Weekly AI & Tech Digest",
  summary: "A comprehensive overview of the most important AI developments this week",
  sender: "AI Digest",
  date: new Date().toISOString(),
  digest: exampleDigest,
};

async function generateExampleDigestPDF() {
  console.log("🚀 Starting example digest PDF generation...");

  const html = await renderAsync(
    React.createElement(WeeklyDigestEmail, { summary: exampleSummary })
  );

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle",
    });

    await page.setViewportSize({ width: 1200, height: 1600 });
    await page.waitForTimeout(2000);

    const downloadsDir = path.join(__dirname, "..", "frontend", "public", "downloads");
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
      console.log("📁 Created downloads directory");
    }

    const pdfPath = path.join(downloadsDir, "example-digest.pdf");

    console.log("📄 Generating PDF...");
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    console.log("✅ PDF generated successfully!");
    console.log("📁 PDF saved to: frontend/public/downloads/example-digest.pdf");

    const stats = fs.statSync(pdfPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`📊 File size: ${fileSizeInMB} MB`);
  } catch (error) {
    console.error("❌ Error generating PDF:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generateExampleDigestPDF().catch(console.error);
