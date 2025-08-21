import OpenAI from "openai";
import { CostTracker } from "../cost-tracker";
import { createLogger } from "../logger";
import { COST_LIMITS } from "../constants";
import type { Summary } from "../types";

const log = createLogger("CriticAgent");

export class CriticAgent {
  private openai: OpenAI;
  private stats = {
    critiquesGenerated: 0,
    apiCallsMade: 0,
    errors: 0,
  };

  constructor(private costTracker: CostTracker) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateCommentary(summaries: Summary[]): Promise<Summary[]> {
    log.info({ count: summaries.length }, "Starting critical commentary");

    const enhancedSummaries: Summary[] = [];

    for (const summary of summaries) {
      try {
        const enhancedSummary = await this.addCritique(summary);
        enhancedSummaries.push(enhancedSummary);
        this.stats.critiquesGenerated++;
      } catch (error) {
        this.stats.errors++;
        log.error({ error, title: summary.title }, "Critique generation failed");
        enhancedSummaries.push(summary);
      }
    }

    log.info(
      { 
        processed: summaries.length,
        critiqued: this.stats.critiquesGenerated 
      },
      "Critical commentary complete"
    );

    return enhancedSummaries;
  }

  private async addCritique(summary: Summary): Promise<Summary> {
    const prompt = `Provide a brief, opinionated take on this AI/tech development:

Title: ${summary.title}
Summary: ${summary.summary}
Key Insights: ${summary.keyInsights?.join(", ")}

Give a contrarian or critical perspective (2-3 sentences) that challenges assumptions or highlights overlooked issues.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a tech critic providing thoughtful, contrarian perspectives on AI developments.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      this.stats.apiCallsMade++;
      this.costTracker.recordApiCall("openai", "critique", COST_LIMITS.OPENAI_GPT4O_MINI_COST);

      const critique = response.choices[0].message.content || "";
      
      return {
        ...summary,
        critique,
      };
    } catch (error) {
      log.error({ error }, "OpenAI critique failed");
      return summary;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}