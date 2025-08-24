import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { differenceInDays, formatISO, isFuture, parseISO } from "date-fns";
import { SecretsLoader } from "../../lib/aws/secrets-loader";

const sfnClient = new SFNClient();

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Load secrets from AWS Secrets Manager on cold start
  try {
    await SecretsLoader.loadSecrets();
  } catch (_error) {
    // Continue anyway as this handler doesn't need secrets directly
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { startDate, endDate, batchSize = 200 } = body;

    // Validate inputs
    if (!startDate || !endDate) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({
          error: "Missing required parameters: startDate, endDate",
        }),
      };
    }

    // Validate date range
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
      }

      if (start > end) {
        throw new Error("startDate must be before or equal to endDate");
      }

      if (isFuture(end)) {
        throw new Error("endDate cannot be in the future");
      }

      const daysDiff = differenceInDays(end, start);
      if (daysDiff > 90) {
        throw new Error("Date range cannot exceed 90 days for cost control");
      }
    } catch (error) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : "Invalid date parameters",
        }),
      };
    }

    // Start Step Functions execution directly
    const command = new StartExecutionCommand({
      stateMachineArn: process.env.STATE_MACHINE_ARN,
      input: JSON.stringify({
        mode: "historical",
        startDate,
        endDate,
        batchSize,
        includeArchived: true,
      }),
    });

    const result = await sfnClient.send(command);

    // Calculate date range in days
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = differenceInDays(end, start) + 1;

    return {
      statusCode: 202,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        success: true,
        message: "Historical digest processing started",
        executionArn: result.executionArn,
        dateRange: {
          start: startDate,
          end: endDate,
          days: days,
        },
        mode: "historical",
        timestamp: formatISO(new Date()),
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to start historical digest processing",
      }),
    };
  }
}
