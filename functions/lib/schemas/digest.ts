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
  summaries: z.array(SummarySchema),
  stats: z.object({
    totalEmails: z.number(),
    aiEmails: z.number(),
    processedEmails: z.number(),
    totalCost: z.number(),
  }),
  mode: z.string(),
  timestamp: z.string(),
});

export type DigestOutput = z.infer<typeof DigestOutputSchema>;
