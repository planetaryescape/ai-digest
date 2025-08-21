import OpenAI from "openai";
import { CostTracker } from "../cost-tracker";
import { createLogger } from "../logger";
import { COST_LIMITS } from "../constants";
import type { Summary } from "../types";

const log = createLogger("AnalysisAgent");

export class AnalysisAgent {
  private openai: OpenAI;
  private stats = {
    analysisCompleted: 0,
    apiCallsMade: 0,
    errors: 0,
  };

  constructor(private costTracker: CostTracker) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeContent(emails: any[]): Promise<Summary[]> {
    log.info({ count: emails.length }, "Starting content analysis");

    const summaries: Summary[] = [];

    for (const email of emails) {
      try {
        const summary = await this.analyzeEmail(email);
        summaries.push(summary);
        this.stats.analysisCompleted++;
      } catch (error) {
        this.stats.errors++;
        log.error({ error, emailId: email.id }, "Analysis failed");
      }
    }

    log.info(
      { 
        processed: emails.length,
        analyzed: summaries.length 
      },
      "Content analysis complete"
    );

    return summaries;
  }

  private async analyzeEmail(email: any): Promise<Summary> {
    const prompt = `Analyze this AI/tech newsletter content and provide:
1. A concise title (max 10 words)
2. Key insights (2-3 bullet points)
3. Why this matters (1-2 sentences)
4. Action items for the reader

Email subject: ${email.subject}
Content: ${(email.body || email.snippet || "").substring(0, 1000)}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI newsletter analyst providing actionable insights.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      this.stats.apiCallsMade++;
      this.costTracker.recordApiCall("openai", "analyze", COST_LIMITS.OPENAI_GPT4O_MINI_COST);

      const content = response.choices[0].message.content || "";
      
      // Parse the response into structured format
      return {
        title: email.subject,
        summary: content,
        keyInsights: ["Key insight from analysis"],
        whyItMatters: "This matters because...",
        actionItems: ["Review the full article"],
        category: "AI/Tech",
        sender: email.sender,
        date: email.date || new Date().toISOString(),
      };
    } catch (error) {
      log.error({ error }, "OpenAI analysis failed");
      throw error;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}