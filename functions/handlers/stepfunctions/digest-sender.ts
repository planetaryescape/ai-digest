import { render } from "@react-email/render";
import type { Context } from "aws-lambda";
import { formatISO } from "date-fns";
import { type gmail_v1, google } from "googleapis";
import { Resend } from "resend";
import WeeklyDigestEmail from "../../../emails/WeeklyDigestClean";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-digest-sender");

/**
 * Step Functions handler for sending the final digest email
 */
export class DigestSenderHandler extends BaseStepFunctionHandler {
  private resend: Resend;
  private gmail: gmail_v1.Gmail | null = null;

  constructor() {
    super();
    this.resend = new Resend(process.env.RESEND_API_KEY);

    // Initialize Gmail if credentials are available
    if (
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
    ) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      });

      this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
    }
  }

  async process(event: any, _context: Context): Promise<any> {
    const executionId = event.metadata?.executionId;
    const mode = event.metadata?.mode;
    const startTime = event.metadata?.startTime;

    // Retrieve analysis result from S3 if needed
    let analysisResult = event.analysisResult;
    if (
      analysisResult &&
      typeof analysisResult === "object" &&
      "type" in analysisResult &&
      analysisResult.type === "s3"
    ) {
      log.info("Retrieving analysis result from S3");
      analysisResult = await this.retrieveFromS3(analysisResult);
    }

    if (!analysisResult) {
      log.error("No analysis result to send");
      throw new Error("No analysis result available for digest");
    }

    // Retrieve classified emails for archiving
    let classifiedEmails = { emails: [] };
    if (event.classifiedEmails) {
      if (
        typeof event.classifiedEmails === "object" &&
        "type" in event.classifiedEmails &&
        event.classifiedEmails.type === "s3"
      ) {
        log.info("Retrieving classified emails from S3");
        classifiedEmails = await this.retrieveFromS3(event.classifiedEmails);
      } else {
        classifiedEmails = event.classifiedEmails;
      }
    }

    const emails = classifiedEmails.emails || [];

    log.info({ emailCount: emails.length }, "Preparing to send digest");

    // Log the analysis structure for debugging
    if (analysisResult?.analysis) {
      const analysis = analysisResult.analysis;
      log.info(
        {
          keyDevelopments: Array.isArray(analysis.keyDevelopments)
            ? analysis.keyDevelopments.length
            : 0,
          keyDevelopmentsSample: analysis.keyDevelopments?.[0],
          patterns: Array.isArray(analysis.patterns) ? analysis.patterns.length : 0,
          technicalInsights: Array.isArray(analysis.technicalInsights)
            ? analysis.technicalInsights.length
            : 0,
          businessOpportunities: Array.isArray(analysis.businessOpportunities)
            ? analysis.businessOpportunities.length
            : 0,
        },
        "Analysis structure"
      );
    }

    // Helper function to extract text from analysis items
    const extractText = (item: any): string => {
      if (typeof item === "string") {
        return item;
      }
      if (typeof item === "object" && item !== null) {
        // Handle patterns with specific structure
        if (item.pattern) {
          let text = item.pattern;
          if (item.evidence && Array.isArray(item.evidence)) {
            text += `. Evidence: ${item.evidence.join("; ")}`;
          }
          if (item.interpretation) {
            text += `. ${item.interpretation}`;
          }
          if (item.strength) {
            text += ` (Strength: ${item.strength})`;
          }
          return text;
        }

        // Handle technical insights/concepts
        if (item.concept) {
          let text = item.concept;
          if (item.explanation) {
            text += `: ${item.explanation}`;
          }
          if (item.practicalApplication) {
            text += `. How to apply: ${item.practicalApplication}`;
          }
          if (item.limitations && Array.isArray(item.limitations)) {
            text += `. Limitations: ${item.limitations.join("; ")}`;
          }
          return text;
        }

        // Handle business opportunities
        if (item.opportunity) {
          let text = item.opportunity;
          if (item.rationale) {
            text += `: ${item.rationale}`;
          }
          if (item.implementation) {
            text += `. Implementation: ${item.implementation}`;
          }
          if (item.risks) {
            text += `. Risks: ${item.risks}`;
          }
          return text;
        }

        // Handle complex GPT-5 response objects with title/significance
        if (item.title && item.significance) {
          let text = item.title;
          if (item.significance) {
            text += `: ${item.significance}`;
          }
          if (item.implications) {
            const implications = Array.isArray(item.implications)
              ? item.implications.join("; ")
              : item.implications;
            text += ` (${implications})`;
          }
          return text;
        }

        // Handle key developments with specific structure
        if (item.development) {
          let text = item.development;
          if (item.context) {
            text += `: ${item.context}`;
          }
          if (item.impact) {
            text += `. Impact: ${item.impact}`;
          }
          return text;
        }

        // Fallback to other common fields
        const fallbackText =
          item.title ||
          item.description ||
          item.text ||
          item.summary ||
          item.content ||
          item.value ||
          item.insight ||
          item.finding ||
          item.observation;
        if (fallbackText) {
          return fallbackText;
        }

        // For completely unknown objects, try to extract meaningful text
        const keys = Object.keys(item);
        if (keys.length > 0) {
          // Build readable text from object properties
          const parts = [];
          for (const key of keys) {
            const value = item[key];
            if (typeof value === "string" && value.length > 0) {
              // Skip metadata fields
              if (!["id", "type", "category", "confidence", "strength"].includes(key)) {
                parts.push(value);
              }
            } else if (Array.isArray(value) && value.length > 0) {
              const strValues = value.filter((v) => typeof v === "string");
              if (strValues.length > 0) {
                parts.push(strValues.join("; "));
              }
            }
          }
          if (parts.length > 0) {
            return parts.join(". ");
          }
        }

        // Absolute last resort - should rarely reach here
        return "[Unable to parse content]";
      }
      return String(item);
    };

    // Transform analysis result to match email template structure
    const transformedDigest = {
      whatHappened: [
        ...(analysisResult.analysis.keyDevelopments || []).map((dev) => {
          const text = extractText(dev);
          // For key developments, extract title if object, otherwise use first 60 chars
          let title = text;
          let description = text;

          if (typeof dev === "object" && dev.title) {
            title = dev.title;
            description = text; // Full formatted text
          } else if (text.length > 60) {
            // Create title from first sentence or 60 chars
            const firstSentence = text.match(/^[^.!?]+[.!?]/);
            title = firstSentence ? firstSentence[0] : `${text.substring(0, 60)}...`;
          }

          return {
            title: title,
            source: "AI Industry Updates",
            category: "Key Development",
            description: description,
          };
        }),
        ...(analysisResult.analysis.patterns || []).map((pattern) => {
          const text = extractText(pattern);
          let title = text;
          let description = text;

          if (typeof pattern === "object" && pattern.title) {
            title = pattern.title;
            description = text;
          } else if (text.length > 60) {
            const firstSentence = text.match(/^[^.!?]+[.!?]/);
            title = firstSentence ? firstSentence[0] : `${text.substring(0, 60)}...`;
          }

          return {
            title: title,
            source: "Trend Analysis",
            category: "Pattern",
            description: description,
          };
        }),
      ].slice(0, 5), // Limit to top 5 items

      takeaways: [
        ...(analysisResult.analysis.technicalInsights || []).map((insight, index) => {
          const text = extractText(insight);
          let title = `Technical Insight #${index + 1}`;

          // Try to extract a better title from the object
          if (typeof insight === "object") {
            if (insight.title) {
              title = insight.title;
            } else if (insight.concept) {
              title = insight.concept;
            } else if (insight.insight) {
              // Use first 50 chars of insight as title
              title =
                insight.insight.length > 50
                  ? `${insight.insight.substring(0, 50)}...`
                  : insight.insight;
            }
          }

          return {
            category: "technical",
            title: title,
            description: text,
            actionable: true,
          };
        }),
        ...(analysisResult.analysis.businessOpportunities || []).map((opp, index) => {
          const text = extractText(opp);
          let title = `Business Opportunity #${index + 1}`;

          // Try to extract a better title from the object
          if (typeof opp === "object") {
            if (opp.title) {
              title = opp.title;
            } else if (opp.opportunity) {
              title =
                opp.opportunity.length > 50
                  ? `${opp.opportunity.substring(0, 50)}...`
                  : opp.opportunity;
            }
          }

          return {
            category: "business",
            title: title,
            description: text,
            actionable: true,
          };
        }),
        ...(analysisResult.analysis.overlooked || []).map((item, index) => {
          const text = extractText(item);
          const title =
            typeof item === "object" && item.title
              ? item.title
              : `Overlooked Insight #${index + 1}`;
          return {
            category: "strategic",
            title: title,
            description: text,
            actionable: false,
          };
        }),
      ].slice(0, 5), // Limit to top 5 items

      sources: analysisResult.analysis.sources || [],
    };

    // Prepare summary for email template
    const summary = {
      digest: transformedDigest,
      message: `Weekly AI Digest - ${emails.length} emails processed`,
      items: emails,
      critique: analysisResult.critique,
      metadata: {
        emailCount: emails.length,
        executionTime: performance.now() - new Date(startTime).getTime(),
        totalCost: event.costSoFar || 0,
      },
    };

    // Render the email HTML
    const emailHtml = await render(WeeklyDigestEmail({ summary, platform: "AWS" }), {
      pretty: true,
    });

    // Send the email
    const recipientEmail = process.env.RECIPIENT_EMAIL;
    if (!recipientEmail) {
      throw new Error("RECIPIENT_EMAIL not configured");
    }

    try {
      const emailResult = await this.resend.emails.send({
        from: "AI Digest <digest@journaler.me>",
        to: recipientEmail,
        subject: `AI Digest - ${new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        html: emailHtml,
      });

      log.info({ emailId: emailResult.data?.id }, "Digest email sent");
    } catch (error) {
      log.error({ error }, "Failed to send digest email");
      throw error;
    }

    // Archive processed emails if configured
    let emailsArchived = 0;
    if (process.env.ARCHIVE_AFTER_PROCESSING === "true" && this.gmail) {
      log.info("Archiving processed emails");

      for (const email of emails) {
        try {
          await this.gmail.users.messages.modify({
            userId: "me",
            id: email.id,
            requestBody: {
              removeLabelIds: ["INBOX"],
            },
          });
          emailsArchived++;
        } catch (error) {
          log.warn({ emailId: email.id, error }, "Failed to archive email");
        }
      }

      log.info({ emailsArchived }, "Emails archived");
    }

    return {
      executionId, // Add at top level for Step Functions
      success: true,
      emailSent: true,
      emailsArchived,
      pipelineStats: {
        totalEmails: emails.length,
        totalCost: event.costSoFar || 0,
        executionTime: performance.now() - new Date(startTime).getTime(),
      },
      metadata: {
        executionId,
        mode,
        completedAt: formatISO(new Date()),
      },
    };
  }
}

// Export handler for Lambda
const handler = new DigestSenderHandler();
export const lambdaHandler = handler.handler.bind(handler);
