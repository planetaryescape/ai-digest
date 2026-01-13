export interface KnownSender {
  senderEmail: string;
  domain: string;
  senderName?: string;
  confirmedAt: string;
  confidence: number; // 0-100, where 100 is absolutely certain it's AI-related
  newsletterName?: string;
  lastSeen: string;
  emailCount: number;
}

export interface ISenderTracker {
  /**
   * Check if a sender is known to send AI-related content
   */
  isKnownAISender(email: string): Promise<boolean>;

  /**
   * Get all known AI senders
   */
  getAllKnownSenders(): Promise<KnownSender[]>;

  /**
   * Get known senders by domain
   */
  getKnownSendersByDomain(domain: string): Promise<KnownSender[]>;

  /**
   * Add or update a confirmed AI sender
   */
  addConfirmedSender(sender: {
    email: string;
    name?: string;
    newsletterName?: string;
  }): Promise<void>;

  /**
   * Batch add multiple confirmed senders
   */
  addMultipleConfirmedSenders(
    senders: Array<{
      email: string;
      name?: string;
      newsletterName?: string;
    }>
  ): Promise<void>;

  /**
   * Update sender confidence score
   */
  updateSenderConfidence(email: string, confidence: number): Promise<void>;

  /**
   * Remove a sender if it's no longer AI-related
   */
  removeSender(email: string): Promise<void>;
}
