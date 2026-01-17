import { Resend } from "resend";
import { createLogger } from "./logger";
import type { Summary } from "./types";

const log = createLogger("EmailService");

let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendDigest(
  summaryOrEmail: Summary | string,
  platformOrSummaries?: string | Summary[],
  mode: string = "weekly"
): Promise<void> {
  // Handle both signatures:
  // sendDigest(summary, platform) - from digest-processor
  // sendDigest(email, summaries[], mode) - traditional
  const isNewStyle = typeof summaryOrEmail === "object";
  const summaries: Summary[] = isNewStyle
    ? [summaryOrEmail as Summary]
    : (platformOrSummaries as Summary[]) || [];
  const recipientEmail = isNewStyle
    ? process.env.RECIPIENT_EMAIL || "digest@example.com"
    : (summaryOrEmail as string);

  log.info({ recipientEmail, summaryCount: summaries.length, mode }, "Sending digest");

  try {
    // In production, this would use the React Email template
    const htmlContent = generateDigestHtml(summaries, mode);

    const { data, error } = await getResendClient().emails.send({
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
  errorOrEmail: Error | string,
  error?: any,
  context?: string
): Promise<void> {
  // Handle both signatures:
  // sendErrorNotification(error) - simple
  // sendErrorNotification(adminEmail, error, context) - full
  const isSimple = errorOrEmail instanceof Error;
  const adminEmail = isSimple
    ? process.env.ADMIN_EMAIL || "admin@example.com"
    : (errorOrEmail as string);
  const actualError = isSimple ? errorOrEmail : error;
  const actualContext = isSimple ? "Digest Processing" : context || "Unknown";

  log.info({ adminEmail, context: actualContext }, "Sending error notification");

  try {
    const { data } = await getResendClient().emails.send({
      from: "AI Digest Alerts <alerts@aiweeklydigest.com>",
      to: adminEmail,
      subject: `[ALERT] AI Digest Error: ${actualContext}`,
      html: `
        <h2>Error in AI Digest Processing</h2>
        <p><strong>Context:</strong> ${actualContext}</p>
        <p><strong>Error:</strong> ${actualError?.message || actualError}</p>
        <pre>${JSON.stringify(actualError, null, 2)}</pre>
      `,
    });

    log.info({ emailId: data?.id }, "Error notification sent");
  } catch (notificationError) {
    log.error({ notificationError }, "Failed to send error notification");
  }
}

export async function sendReauthNotification(errorMessage: string): Promise<void> {
  const recipientEmail =
    process.env.RECIPIENT_EMAIL || process.env.ADMIN_EMAIL || "admin@example.com";
  const reauthUrl =
    process.env.REAUTH_URL ||
    `${process.env.FRONTEND_URL || "http://localhost:3000"}/api/gmail/connect`;

  log.info({ recipientEmail }, "Sending re-auth notification");

  try {
    const { data } = await getResendClient().emails.send({
      from: "AI Digest <digest@aiweeklydigest.com>",
      to: recipientEmail,
      subject: "[Action Required] Re-authorize Gmail Access",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
              .alert { background: #FEF3CD; border: 1px solid #FFE69C; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background: #0066CC; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0; }
              .footer { color: #666; font-size: 14px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <h2>Gmail Access Expired</h2>
            <div class="alert">
              <p><strong>Your weekly digest couldn't be generated</strong> because Gmail access has expired.</p>
              <p>${errorMessage}</p>
            </div>
            <p>This happens periodically when:</p>
            <ul>
              <li>Your Google password changed</li>
              <li>You enabled/disabled 2FA</li>
              <li>The token hasn't been used for 6+ months</li>
              <li>You revoked the app's access in Google settings</li>
            </ul>
            <p>Click below to re-authorize access:</p>
            <a href="${reauthUrl}" class="button">Re-authorize Gmail</a>
            <p class="footer">After re-authorizing, your next scheduled digest will run normally.</p>
          </body>
        </html>
      `,
    });

    log.info({ emailId: data?.id }, "Re-auth notification sent");
  } catch (notificationError) {
    log.error({ notificationError }, "Failed to send re-auth notification");
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
        ${
          summary.keyInsights
            ? `
          <h4>Key Insights:</h4>
          <ul>${summary.keyInsights.map((insight) => `<li>${insight}</li>`).join("")}</ul>
        `
            : ""
        }
        ${summary.whyItMatters ? `<p><strong>Why it matters:</strong> ${summary.whyItMatters}</p>` : ""}
        ${
          summary.actionItems
            ? `
          <h4>Action Items:</h4>
          <ul>${summary.actionItems.map((item) => `<li>${item}</li>`).join("")}</ul>
        `
            : ""
        }
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
