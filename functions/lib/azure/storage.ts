import { AzureNamedKeyCredential, TableClient } from "@azure/data-tables";
import { format, subDays } from "date-fns";
import { config } from "../config";
import type { IStorageClient } from "../interfaces/storage";
import { createLogger, logError } from "../logger";
import type { ProcessedEmail } from "../types";

const log = createLogger("azure-storage");

/**
 * Parse connection string to get account name and key
 */
function parseConnectionString(connectionString: string): {
  accountName: string;
  accountKey: string;
} {
  const parts = connectionString.split(";");
  const accountName = parts.find((p) => p.startsWith("AccountName="))?.split("=")[1] || "";
  const accountKey = parts.find((p) => p.startsWith("AccountKey="))?.split("=")[1] || "";

  if (!accountName || !accountKey) {
    throw new Error("Invalid storage connection string");
  }

  return { accountName, accountKey };
}

/**
 * Azure Table Storage implementation of IStorageClient
 */
export class AzureStorageClient implements IStorageClient {
  private tableClient: TableClient | null;

  constructor() {
    if (!config.azure.storageConnectionString) {
      log.warn(
        "Azure storage connection string not configured - storage operations will be skipped"
      );
      this.tableClient = null;
      return;
    }

    try {
      const { accountName, accountKey } = parseConnectionString(
        config.azure.storageConnectionString
      );
      const credential = new AzureNamedKeyCredential(accountName, accountKey);

      this.tableClient = new TableClient(
        `https://${accountName}.table.core.windows.net`,
        config.azure.tableName,
        credential
      );
    } catch (error) {
      log.warn(
        { error },
        "Failed to initialize Azure storage client - storage operations will be skipped"
      );
      this.tableClient = null;
    }
  }

  /**
   * Create the table if it doesn't exist
   */
  private async ensureTableExists(): Promise<void> {
    if (!this.tableClient) {
      log.warn("Storage not configured, skipping table creation");
      return;
    }

    try {
      await this.tableClient.createTable();
      log.info("Table created or already exists");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (!errorMessage.includes("TableAlreadyExists")) {
        logError(log, error as Error, "Failed to create table");
        throw error;
      }
    }
  }

  async markProcessed(emailId: string, subject: string): Promise<void> {
    if (!this.tableClient) {
      log.warn("Storage not configured, skipping markProcessed");
      return;
    }

    await this.ensureTableExists();

    const entity = {
      partitionKey: "processed",
      rowKey: emailId,
      subject,
      processedAt: new Date().toISOString(),
      timestamp: new Date(),
    };

    try {
      await this.tableClient.upsertEntity(entity);
      log.info(`Marked email as processed: ${emailId}`);
    } catch (error) {
      logError(log, error as Error, `Failed to mark email as processed: ${emailId}`);
      throw error;
    }
  }

  async markMultipleProcessed(emails: Array<{ id: string; subject: string }>): Promise<void> {
    if (!this.tableClient) {
      log.warn("Storage not configured, skipping markMultipleProcessed");
      return;
    }

    await this.ensureTableExists();

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      await Promise.all(batch.map((email) => this.markProcessed(email.id, email.subject)));
    }
  }

  async getWeeklyProcessedIds(): Promise<string[]> {
    if (!this.tableClient) {
      log.warn("Storage not configured, returning empty processed list");
      return [];
    }

    await this.ensureTableExists();

    const oneWeekAgo = subDays(new Date(), 7);
    const dateFilter = format(oneWeekAgo, "yyyy-MM-dd'T'HH:mm:ss'Z'");

    try {
      const entities = this.tableClient.listEntities({
        queryOptions: {
          filter: `PartitionKey eq 'processed' and processedAt ge '${dateFilter}'`,
        },
      });

      const ids: string[] = [];
      for await (const entity of entities) {
        ids.push(entity.rowKey as string);
      }

      log.info(`Found ${ids.length} processed emails from the last week`);
      return ids;
    } catch (error) {
      logError(log, error as Error, "Failed to get weekly processed IDs");
      return [];
    }
  }

  async getAllProcessedIds(): Promise<string[]> {
    if (!this.tableClient) {
      log.warn("Storage not configured, returning empty list");
      return [];
    }

    await this.ensureTableExists();

    try {
      const entities = this.tableClient.listEntities({
        queryOptions: {
          filter: "PartitionKey eq 'processed'",
        },
      });

      const ids: string[] = [];
      for await (const entity of entities) {
        ids.push(entity.rowKey as string);
      }

      log.info(`Retrieved ${ids.length} processed email IDs`);
      return ids;
    } catch (error) {
      logError(log, error as Error, "Failed to get all processed IDs");
      return [];
    }
  }

  async getAllProcessed(): Promise<ProcessedEmail[]> {
    if (!this.tableClient) {
      log.warn("Storage not configured, returning empty list");
      return [];
    }

    await this.ensureTableExists();

    try {
      const entities = this.tableClient.listEntities({
        queryOptions: {
          filter: "PartitionKey eq 'processed'",
        },
      });

      const processed: ProcessedEmail[] = [];
      for await (const entity of entities) {
        processed.push({
          partitionKey: "email",
          rowKey: entity.rowKey as string,
          emailId: entity.rowKey as string,
          subject: entity.subject as string,
          processedAt: entity.processedAt as string,
        });
      }

      log.info(`Retrieved ${processed.length} processed emails`);
      return processed;
    } catch (error) {
      logError(log, error as Error, "Failed to get all processed emails");
      return [];
    }
  }

  async isProcessed(emailId: string): Promise<boolean> {
    if (!this.tableClient) {
      log.warn("Storage not configured, returning false");
      return false;
    }

    try {
      await this.tableClient.getEntity("processed", emailId);
      return true;
    } catch {
      return false;
    }
  }

  async cleanupOldRecords(daysToKeep: number): Promise<number> {
    if (!this.tableClient) {
      log.warn("Storage not configured, skipping cleanup");
      return 0;
    }

    const cutoffDate = subDays(new Date(), daysToKeep);
    const dateFilter = format(cutoffDate, "yyyy-MM-dd'T'HH:mm:ss'Z'");

    try {
      const entities = this.tableClient.listEntities({
        queryOptions: {
          filter: `PartitionKey eq 'processed' and processedAt lt '${dateFilter}'`,
        },
      });

      let count = 0;
      for await (const entity of entities) {
        await this.tableClient.deleteEntity("processed", entity.rowKey as string);
        count++;
      }

      if (count > 0) {
        log.info(`Cleaned up ${count} old processed records`);
      }
      return count;
    } catch (error) {
      logError(log, error as Error, "Failed to cleanup old records");
      return 0;
    }
  }
}
