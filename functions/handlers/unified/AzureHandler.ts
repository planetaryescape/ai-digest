import type { HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { AzureStorageClient } from "../../lib/azure/storage";
import type { IStorageClient } from "../../lib/interfaces/storage";
import { AzurePlatformAdapter } from "./AzurePlatformAdapter";
import { BaseHandler } from "./BaseHandler";
import type { IPlatformAdapter } from "./IPlatformAdapter";

/**
 * Azure-specific unified handler
 */
export class AzureHandler extends BaseHandler {
  private adapter: IPlatformAdapter;
  private storage: IStorageClient;

  constructor() {
    super();
    this.adapter = new AzurePlatformAdapter();
    this.storage = new AzureStorageClient();
  }

  protected getPlatformAdapter(): IPlatformAdapter {
    return this.adapter;
  }

  protected getStorage(): IStorageClient {
    return this.storage;
  }

  protected getPlatformName(): string {
    return "azure";
  }

  /**
   * Azure Function entry point
   */
  async azureFunction(
    trigger: Timer | HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit | undefined> {
    const result = await this.handle(trigger, context);

    // For timer triggers, Azure expects undefined return
    const isTimerTrigger = trigger && "isPastDue" in trigger;
    if (isTimerTrigger) {
      // Log result for timer triggers
      if (!result.success) {
        throw new Error(result.error || "Digest processing failed");
      }
      return undefined;
    }

    // For HTTP triggers, return the formatted response
    return result;
  }
}

/**
 * Export factory function for Azure Functions
 */
export function createAzureHandler() {
  const handler = new AzureHandler();
  return handler.azureFunction.bind(handler);
}
