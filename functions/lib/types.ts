export interface Summary {
  title: string;
  summary: string;
  keyInsights?: string[];
  whyItMatters?: string;
  actionItems?: string[];
  category?: string;
  sender: string;
  date: string;
  critique?: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  date: string;
  snippet: string;
  body: string;
  isAI?: boolean;
  isKnownAI?: boolean;
  isKnownNonAI?: boolean;
  isUnknown?: boolean;
  extractedUrls?: string[];
  articleContent?: string;
  research?: any;
}

export interface DigestResult {
  summaries: Summary[];
  stats: {
    totalEmails: number;
    aiEmails: number;
    processedEmails: number;
    totalCost: number;
  };
  mode: string;
  timestamp: string;
}