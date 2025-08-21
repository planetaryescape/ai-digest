import { Resend } from "resend";
import { createLogger } from "./logger";
import type { Summary } from "./types";

const log = createLogger("EmailService");

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDigest(
  recipientEmail: string,
  summaries: Summary[],
  mode: string = "weekly"
): Promise<void> {
  log.info({ recipientEmail, summaryCount: summaries.length, mode }, "Sending digest");

  try {
    // In production, this would use the React Email template
    const htmlContent = generateDigestHtml(summaries, mode);

    const { data, error } = await resend.emails.send({
      from: "AI Digest <digest@aiweeklydigest.com>",
      to: recipientEmail,
      subject: `Your ${mode === "weekly" ? "Weekly" : mode} AI Digest`,
      html: htmlContent,
    });

    if (error) {
      throw error;
    }

    log.info({ emailId: data?.id }, "Digest sent successfully");
  } catch (error) {
    log.error({ error }, "Failed to send digest");
    throw error;
  }
}

export async function sendErrorNotification(
  adminEmail: string,
  error: any,
  context: string
): Promise<void> {
  log.info({ adminEmail, context }, "Sending error notification");

  try {
    const { data } = await resend.emails.send({
      from: "AI Digest Alerts <alerts@aiweeklydigest.com>",
      to: adminEmail,
      subject: `[ALERT] AI Digest Error: ${context}`,
      html: `
        <h2>Error in AI Digest Processing</h2>
        <p><strong>Context:</strong> ${context}</p>
        <p><strong>Error:</strong> ${error.message || error}</p>
        <pre>${JSON.stringify(error, null, 2)}</pre>
      `,
    });

    log.info({ emailId: data?.id }, "Error notification sent");
  } catch (notificationError) {
    log.error({ notificationError }, "Failed to send error notification");
  }
}

function generateDigestHtml(summaries: Summary[], mode: string): string {
  // Simple HTML template - in production this would use React Email
  const summaryHtml = summaries
    .map(
      (summary) => `
      <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h3>${summary.title}</h3>
        <p><strong>From:</strong> ${summary.sender}</p>
        <p>${summary.summary}</p>
        ${summary.keyInsights ? `
          <h4>Key Insights:</h4>
          <ul>${summary.keyInsights.map(insight => `<li>${insight}</li>`).join("")}</ul>
        ` : ""}
        ${summary.whyItMatters ? `<p><strong>Why it matters:</strong> ${summary.whyItMatters}</p>` : ""}
        ${summary.actionItems ? `
          <h4>Action Items:</h4>
          <ul>${summary.actionItems.map(item => `<li>${item}</li>`).join("")}</ul>
        ` : ""}
        ${summary.critique ? `<p><em>Critical Take: ${summary.critique}</em></p>` : ""}
      </div>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          h3 { color: #555; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Your ${mode === "weekly" ? "Weekly" : mode} AI Digest</h1>
          <p>Here are the most important AI/tech updates from your newsletters:</p>
          ${summaryHtml}
          <hr>
          <p style="color: #888; font-size: 12px;">
            Powered by AI Digest | 
            <a href="https://aiweeklydigest.com/unsubscribe">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>
  `;
}