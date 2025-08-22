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
  digest?: string;
  message?: string;
  items?: any[];
  headline?: string;
  whatHappened?: string;
  takeaways?: string;
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

export interface EmailItem {
  id: string;
  subject: string;
  sender: string;
  date: string;
  body: string;
  threadId: string;
  snippet: string;
  isAI?: boolean;
  isKnownAI?: boolean;
  isKnownNonAI?: boolean;
  isUnknown?: boolean;
  extractedUrls?: string[];
  articleContent?: string;
  research?: any;
}

export interface ProcessedEmail {
  id: string;
  subject: string;
  processed_at: string;
}

export interface Article {
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
  author?: string;
}

export interface App {
  name: string;
  version: string;
  environment: string;
}

export interface ProductContext {
  product: string;
  stage: string;
  version: string;
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
  headline?: string;
  shortMessage?: string;
  whatHappened?: string;
  takeaways?: string;
}
