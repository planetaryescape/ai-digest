import { Lambda } from "@aws-sdk/client-lambda";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  ScheduledEvent,
} from "aws-lambda";
import type { IStorageClient } from "../../lib/interfaces/storage";
import { StorageFactory } from "../../lib/storage-factory";
import { AWSPlatformAdapter } from "./AWSPlatformAdapter";
import { BaseHandler } from "./BaseHandler";
import type { IPlatformAdapter } from "./IPlatformAdapter";
import type { UnifiedRequest } from "./types";

/**
 * AWS-specific unified handler
 */
export class AWSHandler extends BaseHandler {
  private adapter: IPlatformAdapter;
  private storage: IStorageClient;
  private lambda: Lambda;

  constructor() {
    super();
    this.adapter = new AWSPlatformAdapter();
    this.storage = StorageFactory.create();
    this.lambda = new Lambda();
  }

  protected getPlatformAdapter(): IPlatformAdapter {
    return this.adapter;
  }

  protected getStorage(): IStorageClient {
    return this.storage;
  }

  protected getPlatformName(): string {
    return "aws";
  }

  /**
   * Handle async invocation for cleanup mode
   */
  protected async handleAsyncInvocation(request: UnifiedRequest): Promise<void> {
    if (!request.cleanup) {
      return;
    }

    const functionName = process.env.WEEKLY_DIGEST_FUNCTION_NAME;
    if (!functionName) {
      throw new Error("WEEKLY_DIGEST_FUNCTION_NAME not configured");
    }

    // Invoke weekly-digest function asynchronously
    // biome-ignore lint/style/useNamingConvention: AWS SDK requirement
    await this.lambda.send(
      new (await import("@aws-sdk/client-lambda")).InvokeCommand({
        FunctionName: functionName,
        InvocationType: "Event",
        Payload: JSON.stringify({ cleanup: true }),
      })
    );
  }

  /**
   * AWS Lambda entry point for scheduled events
   */
  async scheduledHandler(event: ScheduledEvent, context: Context): Promise<void> {
    await this.handle(event, context);
  }

  /**
   * AWS Lambda entry point for API Gateway events
   */
  async httpHandler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const adapter = this.getPlatformAdapter();
    const request = adapter.parseRequest(event, context);

    // For cleanup mode, trigger async and return immediately
    if (request.cleanup) {
      const unifiedContext = adapter.createContext(context);

      try {
        await this.handleAsyncInvocation(request);

        return adapter.formatResponse({
          success: true,
          message: "Cleanup digest processing started",
          emailsFound: 0,
          emailsProcessed: 0,
          invocationId: context.awsRequestId,
        });
      } catch (error) {
        unifiedContext.logger.error("Failed to trigger cleanup", error);

        if (error instanceof Error) {
          return adapter.formatError(error, unifiedContext);
        }

        return adapter.formatError(
          new Error("Failed to trigger cleanup processing"),
          unifiedContext
        );
      }
    }

    // For regular mode, process synchronously
    return this.handle(event, context);
  }
}

/**
 * Export factory functions for AWS Lambda
 */
export function createScheduledHandler() {
  const handler = new AWSHandler();
  return handler.scheduledHandler.bind(handler);
}

export function createHttpHandler() {
  const handler = new AWSHandler();
  return handler.httpHandler.bind(handler);
}
