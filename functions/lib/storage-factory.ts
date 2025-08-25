// import { S3StorageClient } from "./aws/s3-storage";
// import { DynamoDBStorageClient } from "./aws/storage";
// import { AzureStorageClient } from "./azure/storage";
// import { MockStorageClient } from "./aws/mock-storage";
import type { IStorageClient } from "./interfaces/storage";

export enum StorageType {
  S3 = "s3",
  DynamoDB = "dynamodb",
  Azure = "azure",
}

/**
 * Simple mock storage implementation for compilation
 */
class MockStorageClient implements IStorageClient {
  async store(key: string, data: any): Promise<boolean> {
    console.log(`Mock storage: storing ${key}`, data);
    return true;
  }
  async retrieve(key: string): Promise<any> {
    console.log(`Mock storage: retrieving ${key}`);
    return null;
  }
  async delete(key: string): Promise<boolean> {
    console.log(`Mock storage: deleting ${key}`);
    return true;
  }
}

/**
 * Factory for creating storage clients based on configuration
 * Implements the Strategy pattern for storage selection
 */
export class StorageFactory {
  private static storageProviders = new Map<string, () => IStorageClient>([
    // TODO: Implement real storage clients
    [StorageType.S3, () => new MockStorageClient()],
    [StorageType.DynamoDB, () => new MockStorageClient()],
    [StorageType.Azure, () => new MockStorageClient()],
  ]);

  /**
   * Create a storage client based on environment configuration
   */
  static create(): IStorageClient {
    const storageType = process.env.STORAGE_TYPE?.toLowerCase();

    // Azure detection
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      return StorageFactory.createByType(StorageType.Azure);
    }

    // AWS detection
    if (storageType) {
      return StorageFactory.createByType(storageType as StorageType);
    }

    // Default to DynamoDB for AWS environments
    if (process.env.AWS_REGION || process.env.DYNAMODB_TABLE_NAME) {
      return StorageFactory.createByType(StorageType.DynamoDB);
    }
    return StorageFactory.createByType(StorageType.DynamoDB);
  }

  /**
   * Create a storage client by explicit type
   */
  static createByType(type: StorageType | string): IStorageClient {
    const provider = StorageFactory.storageProviders.get(type.toLowerCase());

    if (!provider) {
      throw new Error(
        `Unknown storage type: ${type}. Available types: ${Array.from(StorageFactory.storageProviders.keys()).join(", ")}`
      );
    }
    return provider();
  }

  /**
   * Register a custom storage provider
   */
  static registerProvider(type: string, provider: () => IStorageClient): void {
    StorageFactory.storageProviders.set(type.toLowerCase(), provider);
  }

  /**
   * Get available storage types
   */
  static getAvailableTypes(): string[] {
    return Array.from(StorageFactory.storageProviders.keys());
  }
}
