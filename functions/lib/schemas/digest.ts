import { z } from "zod";

export const SummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyInsights: z.array(z.string()).optional(),
  whyItMatters: z.string().optional(),
  actionItems: z.array(z.string()).optional(),
  category: z.string().optional(),
  sender: z.string(),
  date: z.string(),
  critique: z.string().optional(),
});

export const DigestOutputSchema = z.object({
  summaries: z.array(SummarySchema).optional(),
  stats: z
    .object({
      totalEmails: z.number(),
      aiEmails: z.number(),
      processedEmails: z.number(),
      totalCost: z.number(),
    })
    .optional(),
  mode: z.string().optional(),
  timestamp: z.string().optional(),
  headline: z.string().optional(),
  shortMessage: z.string().optional(),
  whatHappened: z.union([z.string(), z.array(z.any())]).optional(),
  takeaways: z.union([z.string(), z.array(z.any())]).optional(),
  summary: z.string().optional(),
  productPlays: z.array(z.any()).optional(),
  keyThemes: z.array(z.string()).optional(),
  competitiveIntel: z.array(z.any()).optional(),
  tools: z.array(z.any()).optional(),
  rolePlays: z.array(z.any()).optional(),
  sources: z.array(z.any()).optional(),
});

export type DigestOutput = z.infer<typeof DigestOutputSchema>;
