import type { ISenderTracker } from "../interfaces/sender-tracker";

/**
 * Strategy interface for AI email detection
 */
export interface AIDetectionStrategy {
  detect(subject: string, sender: string, senderTracker?: ISenderTracker): Promise<boolean>;
}

/**
 * Detects AI emails based on known sender list
 */
export class KnownSenderStrategy implements AIDetectionStrategy {
  async detect(_subject: string, sender: string, senderTracker?: ISenderTracker): Promise<boolean> {
    if (!senderTracker) return false;

    const senderEmail = this.extractEmailAddress(sender);
    if (!senderEmail) return false;

    return senderTracker.isKnownAISender(senderEmail);
  }

  private extractEmailAddress(sender: string): string | null {
    const match = sender.match(/<([^>]+)>/);
    if (match) {
      return match[1].toLowerCase();
    }
    // If no angle brackets, check if it looks like an email
    if (sender.includes("@")) {
      return sender.toLowerCase();
    }
    return null;
  }
}

/**
 * Detects AI emails based on keyword matching
 */
export class KeywordStrategy implements AIDetectionStrategy {
  constructor(
    private keywords: string[] = [],
    private additionalKeywords: string[] = []
  ) {}

  async detect(subject: string, sender: string): Promise<boolean> {
    const allKeywords = [...this.keywords, ...this.additionalKeywords];

    // If no keywords provided, don't match
    if (allKeywords.length === 0) {
      return false;
    }

    const subjectLower = subject?.toLowerCase() || "";
    const senderLower = sender?.toLowerCase() || "";
    const combinedText = `${subjectLower} ${senderLower}`;

    for (const keyword of allKeywords) {
      const keywordLower = keyword.toLowerCase();

      // Check for word boundaries (with spaces) OR as part of compound words
      if (
        combinedText.includes(` ${keywordLower} `) || // Word with spaces
        combinedText.includes(` ${keywordLower}`) || // Word at end
        combinedText.includes(`${keywordLower} `) || // Word at start
        combinedText.includes(keywordLower) // Anywhere (for AI, ML, etc.)
      ) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Detects AI emails based on regex patterns
 */
export class PatternStrategy implements AIDetectionStrategy {
  private patterns: RegExp[] = [
    /\bai[\s\-_]?essentials?\b/i,
    /\bai[\s\-_]?newsletter/i,
    /\bai[\s\-_]?weekly/i,
    /\bai[\s\-_]?digest/i,
    /\bai[\s\-_]?report/i,
    /\bai[\s\-_]?update/i,
    /\bmachine[\s\-_]?learning/i,
    /\bdeep[\s\-_]?learning/i,
    /\bartificial[\s\-_]?intelligence/i,
    /\bgenerative[\s\-_]?ai/i,
    /\b(?:gpt|claude|llm|chatgpt|openai|anthropic|gemini|copilot)\b/i,
    // New patterns for better detection
    /\b(?:foundation|frontier)\s*models?\b/i,
    /\b(?:rlhf|reinforcement|fine[\s-]?tun)/i,
    /\bagent(?:ic|s)?\s*(?:ai|systems?|workflows?)\b/i,
    /\b(?:computer|code)\s*vision\b/i,
    /\b(?:nlp|nlu|natural\s*language)\b/i,
    /\b(?:transformer|diffusion|gan|gans)\b/i,
    /\b(?:neural\s*networks?|deep\s*learning|ml\s*ops)\b/i,
    /\b(?:prompt\s*engineering|prompting|zero[\s-]?shot)\b/i,
    /\b(?:embedding|vector\s*(?:database|store|search))\b/i,
    /\b(?:langchain|llamaindex|autogpt|baby[\s-]?agi)\b/i,
  ];

  constructor(additionalPatterns: RegExp[] = []) {
    this.patterns = [...this.patterns, ...additionalPatterns];
  }

  async detect(subject: string, sender: string): Promise<boolean> {
    const combinedText = `${subject?.toLowerCase() || ""} ${sender?.toLowerCase() || ""}`;

    for (const pattern of this.patterns) {
      if (pattern.test(combinedText)) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Detects AI emails based on sender email domain patterns
 */
export class EmailDomainStrategy implements AIDetectionStrategy {
  private aiDomainPattern = /(^|[.+-_])ai([.+-_]|@|$)/i;

  async detect(_subject: string, sender: string): Promise<boolean> {
    return this.aiDomainPattern.test(sender);
  }
}

/**
 * Composite strategy that combines multiple detection strategies
 */
export class CompositeAIDetectionStrategy implements AIDetectionStrategy {
  constructor(private strategies: AIDetectionStrategy[] = []) {}

  async detect(subject: string, sender: string, senderTracker?: ISenderTracker): Promise<boolean> {
    // Run strategies in sequence (short-circuit on first match)
    for (const strategy of this.strategies) {
      if (await strategy.detect(subject, sender, senderTracker)) {
        return true;
      }
    }
    return false;
  }

  addStrategy(strategy: AIDetectionStrategy): void {
    this.strategies.push(strategy);
  }

  removeStrategy(strategy: AIDetectionStrategy): void {
    const index = this.strategies.indexOf(strategy);
    if (index > -1) {
      this.strategies.splice(index, 1);
    }
  }
}

/**
 * Factory for creating default AI detection strategy
 */
export class AIDetectionStrategyFactory {
  static createDefault(
    keywords: string[] = [],
    additionalKeywords: string[] = [],
    senderTracker?: ISenderTracker
  ): CompositeAIDetectionStrategy {
    const strategies: AIDetectionStrategy[] = [];

    // Add strategies in order of efficiency (fastest first)
    if (senderTracker) {
      strategies.push(new KnownSenderStrategy());
    }
    strategies.push(new EmailDomainStrategy());
    strategies.push(new KeywordStrategy(keywords, additionalKeywords));
    strategies.push(new PatternStrategy());

    return new CompositeAIDetectionStrategy(strategies);
  }
}
