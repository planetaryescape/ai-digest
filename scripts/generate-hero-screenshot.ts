#!/usr/bin/env bun

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

const sampleDigest: DigestOutput = {
  headline: "AI Agents Revolution: Autonomous Systems Are Here",
  summary:
    "This week brought groundbreaking developments in AI agent capabilities. OpenAI's new reasoning models show unprecedented problem-solving abilities, while practical applications in coding, research, and automation are transforming workflows across industries.",
  keyThemes: ["AI Reasoning", "Autonomous Agents", "Voice AI", "Developer Tools"],
  keyInsights: [
    {
      insight: "GPT-5 level reasoning is becoming accessible through new techniques",
      impact: "Enables complex multi-step problem solving previously impossible",
      actionability: "Start experimenting with chain-of-thought prompting in your workflows",
    },
    {
      insight: "AI coding assistants now handle entire features, not just snippets",
      impact: "10x productivity gains for developers adopting these tools",
      actionability: "Integrate Cursor or Windsurf into your development process",
    },
    {
      insight: "Voice AI quality crossed the uncanny valley threshold",
      impact: "Natural conversations with AI are now production-ready",
      actionability: "Consider voice interfaces for your next user-facing feature",
    },
  ],
  competitiveIntel: [
    {
      insight: "OpenAI's o1 model shows 90% accuracy on PhD-level physics problems",
      players: ["OpenAI", "Meta", "Google"],
      implication:
        "Traditional model architectures are being disrupted by reasoning-focused approaches",
    },
    {
      insight: "Anthropic's Claude 3.5 Sonnet leads in coding benchmarks",
      players: ["Anthropic", "OpenAI", "GitHub Copilot"],
      implication: "The coding assistant market is becoming increasingly competitive",
    },
    {
      insight: "Google's Gemini 2.0 brings multimodal understanding to new heights",
      players: ["Google", "OpenAI", "Microsoft"],
      implication: "Multimodal capabilities are now table stakes for frontier models",
    },
  ],
  whatHappened: [
    {
      title: "OpenAI Ships o1 Reasoning Model",
      source: "OpenAI Blog",
      category: "AI Models",
      description:
        "OpenAI released their o1 model with breakthrough reasoning capabilities, achieving human-level performance on complex multi-step problems.",
    },
    {
      title: "Claude 3.5 Sonnet Dominates Coding Benchmarks",
      source: "Anthropic",
      category: "Developer Tools",
      description:
        "Anthropic's latest model sets new records on HumanEval and other coding benchmarks, outperforming GPT-4 by significant margins.",
    },
    {
      title: "Voice AI Crosses Quality Threshold",
      source: "TechCrunch",
      category: "Voice Tech",
      description:
        "Multiple startups report voice AI quality improvements that make real-time conversation indistinguishable from human interaction.",
    },
  ],
  takeaways: [
    {
      title: "Reasoning Models Are Game-Changers",
      description:
        "The new reasoning capabilities enable AI to tackle problems that were impossible just months ago. Time to rethink your product roadmap.",
      category: "technical",
      actionable: true,
    },
    {
      title: "AI Coding Assistants ROI is Proven",
      description:
        "73% productivity improvement isn't a marketing claim - it's backed by data from thousands of developers. Budget for these tools now.",
      category: "business",
      actionable: true,
    },
    {
      title: "Voice Interface Competition Heating Up",
      description:
        "Major players are all racing to own the voice AI space. Early movers will have significant advantages in user acquisition.",
      category: "business",
      actionable: false,
    },
  ],
  productPlays: [
    {
      appName: "Your SaaS App",
      feature: "AI-Powered Onboarding Assistant",
      description:
        "Implement a conversational onboarding flow using o1's reasoning to understand user needs and customize the experience.",
      effort: "quick-win",
      impact: "high",
    },
    {
      appName: "Your Developer Tool",
      feature: "Code Review Automation",
      description:
        "Use Claude 3.5 Sonnet to automatically review PRs, explain changes, and suggest improvements.",
      effort: "1-2-days",
      impact: "high",
    },
  ],
  summaries: [
    {
      title: "OpenAI's o1: A New Paradigm in AI Reasoning",
      summary:
        "Deep dive into how o1 achieves human-level reasoning through novel training approaches and what this means for AI applications.",
      keyInsights: [
        "Chain-of-thought reasoning at scale",
        "90% accuracy on PhD-level problems",
        "New paradigm for AI applications",
      ],
      whyItMatters: "This breakthrough enables entirely new categories of AI applications",
      actionItems: [
        "Test o1 on your hardest problems",
        "Explore reasoning chains in your products",
      ],
      category: "AI Models",
      sender: "newsletter@openai.com",
      date: new Date().toISOString(),
    },
    {
      title: "The Rise of AI Coding Assistants",
      summary:
        "Survey of 10,000 developers reveals 73% productivity improvement with AI coding tools, reshaping how software is built.",
      keyInsights: [
        "73% productivity improvement proven",
        "AI assistants becoming essential tools",
        "Rapid adoption across enterprises",
      ],
      whyItMatters:
        "AI coding assistants are no longer optional - they're essential for competitive advantage",
      actionItems: ["Adopt Cursor or Windsurf", "Train team on AI pair programming"],
      category: "Developer Tools",
      sender: "digest@github.com",
      date: new Date().toISOString(),
    },
    {
      title: "Voice AI Crosses the Uncanny Valley",
      summary:
        "Multiple startups report voice AI quality improvements that make real-time conversation indistinguishable from human interaction.",
      keyInsights: [
        "Natural conversation now possible",
        "Sub-200ms latency achieved",
        "Voice cloning indistinguishable from real",
      ],
      whyItMatters:
        "Voice interfaces are ready for production deployment in customer-facing applications",
      actionItems: ["Prototype voice features", "Evaluate voice AI providers"],
      category: "Voice Tech",
      sender: "updates@techcrunch.com",
      date: new Date().toISOString(),
    },
  ],
  stats: {
    totalEmails: 156,
    aiEmails: 47,
    processedEmails: 47,
    totalCost: 0.12,
  },
  mode: "weekly",
  timestamp: new Date().toISOString(),
};

const sampleSummary: Summary = {
  id: "sample-digest",
  userId: "demo",
  dateRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  processedCount: 47,
  digest: sampleDigest,
  senders: [
    { email: "newsletter@openai.com", count: 3 },
    { email: "digest@anthropic.com", count: 2 },
    { email: "updates@github.com", count: 5 },
  ],
  processingTimeMs: 45000,
  createdAt: new Date().toISOString(),
};

async function generateScreenshots() {
  console.log("🚀 Starting screenshot generation...");

  const html = await renderAsync(
    React.createElement(WeeklyDigestEmail, { summary: sampleSummary })
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

    console.log("📸 Generating desktop hero screenshot (1200x800)...");
    const desktopElement = await page.$("body");
    if (desktopElement) {
      const desktopPath = path.join(
        __dirname,
        "..",
        "frontend",
        "public",
        "images",
        "hero-digest-email.png"
      );
      await desktopElement.screenshot({
        path: desktopPath,
        clip: {
          x: 0,
          y: 0,
          width: 1200,
          height: 800,
        },
      });
      console.log("✅ Desktop screenshot saved!");
    }

    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(1000);

    console.log("📱 Generating mobile hero screenshot (600x400)...");
    const mobileElement = await page.$("body");
    if (mobileElement) {
      const mobilePath = path.join(
        __dirname,
        "..",
        "frontend",
        "public",
        "images",
        "hero-digest-email-mobile.png"
      );
      await mobileElement.screenshot({
        path: mobilePath,
        clip: {
          x: 0,
          y: 0,
          width: 600,
          height: 400,
        },
      });
      console.log("✅ Mobile screenshot saved!");
    }

    console.log("🎉 All screenshots generated successfully!");
    console.log("📁 Screenshots saved to: frontend/public/images/");
  } catch (error) {
    console.error("❌ Error generating screenshots:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

generateScreenshots().catch(console.error);
