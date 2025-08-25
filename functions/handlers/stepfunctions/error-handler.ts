import type { Context } from "aws-lambda";
import { formatISO } from "date-fns";
import { Resend } from "resend";
import { createLogger } from "../../lib/logger";
import { BaseStepFunctionHandler } from "./base-handler";

const log = createLogger("sf-error-handler");

/**
 * Step Functions handler for error handling and notifications
 */
export class ErrorHandler extends BaseStepFunctionHandler {
  private resend: Resend;

  constructor() {
    super();
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async process(event: any, context: Context): Promise<any> {
    const error = event.error;
    const executionArn = event.executionArn;
    const stateMachineArn = event.stateMachineArn;
    const state = event.state;
    const input = event.input;

    log.error(
      {
        error,
        executionArn,
        stateMachineArn,
        state,
      },
      "Pipeline error occurred"
    );

    // Send error notification if configured
    const recipientEmail = process.env.RECIPIENT_EMAIL;
    if (recipientEmail && process.env.SEND_ERROR_NOTIFICATIONS !== "false") {
      try {
        await this.resend.emails.send({
          from: "AI Digest Alerts <alerts@journaler.me>",
          to: recipientEmail,
          subject: "AI Digest Pipeline Error",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Pipeline Error</h2>
              
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p><strong>Error Type:</strong> ${error?.Error || "Unknown"}</p>
                <p><strong>Error Message:</strong> ${error?.Cause || "No details available"}</p>
                <p><strong>Failed State:</strong> ${state || "Unknown"}</p>
              </div>
              
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <h3 style="margin-top: 0;">Execution Details</h3>
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>Execution ARN:</strong><br/>
                  <code style="font-size: 12px;">${executionArn}</code>
                </p>
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>State Machine:</strong><br/>
                  <code style="font-size: 12px;">${stateMachineArn}</code>
                </p>
                <p style="font-size: 14px; color: #6b7280;">
                  <strong>Timestamp:</strong> ${formatISO(new Date())}
                </p>
              </div>
              
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 14px; color: #6b7280;">
                  View the execution in the 
                  <a href="https://console.aws.amazon.com/states/home?region=${process.env.AWS_REGION || "us-east-1"}#/executions/details/${executionArn}" 
                     style="color: #3b82f6;">AWS Step Functions Console</a>
                </p>
              </div>
            </div>
          `,
        });

        log.info("Error notification sent");
      } catch (emailError) {
        log.error({ emailError }, "Failed to send error notification");
      }
    }

    // Store error details in S3 for debugging
    const errorDetails = {
      error,
      executionArn,
      stateMachineArn,
      state,
      input,
      timestamp: formatISO(new Date()),
      context: {
        requestId: context.awsRequestId,
        functionName: context.functionName,
        functionVersion: context.functionVersion,
      },
    };

    const errorKey = `errors/${executionArn.split(":").pop()}/error-${performance.now()}.json`;
    await this.storeInS3(errorDetails, errorKey);

    log.info({ errorKey }, "Error details stored in S3");

    return {
      handled: true,
      notificationSent: !!recipientEmail,
      errorStored: errorKey,
      timestamp: formatISO(new Date()),
    };
  }
}

// Export handler for Lambda
const handler = new ErrorHandler();
export const lambdaHandler = handler.handler.bind(handler);
