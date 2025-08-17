export interface KnownSender {
  senderEmail: string
  domain: string
  senderName?: string
  confirmedAt: string
  confidence: number
  newsletterName?: string
  lastSeen: string
  emailCount: number
}