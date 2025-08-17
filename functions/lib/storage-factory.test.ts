import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S3StorageClient } from "./aws/s3-storage";
import { DynamoDBStorageClient } from "./aws/storage";
import { AzureStorageClient } from "./azure/storage";
import { StorageFactory, StorageType } from "./storage-factory";

// Mock storage clients
vi.mock("./aws/storage", () => ({
  DynamoDBStorageClient: vi.fn().mockImplementation(() => ({ type: "dynamodb" })),
}));

vi.mock("./aws/s3-storage", () => ({
  S3StorageClient: vi.fn().mockImplementation(() => ({ type: "s3" })),
}));

vi.mock("./azure/storage", () => ({
  AzureStorageClient: vi.fn().mockImplementation(() => ({ type: "azure" })),
}));

describe("StorageFactory", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("create()", () => {
    it("should create S3 storage when STORAGE_TYPE is s3", () => {
      process.env.STORAGE_TYPE = "s3";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "s3" });
      expect(S3StorageClient).toHaveBeenCalled();
    });

    it("should create DynamoDB storage when STORAGE_TYPE is dynamodb", () => {
      process.env.STORAGE_TYPE = "dynamodb";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "dynamodb" });
      expect(DynamoDBStorageClient).toHaveBeenCalled();
    });

    it("should create Azure storage when AZURE_STORAGE_CONNECTION_STRING is set", () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = "azure-connection";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "azure" });
      expect(AzureStorageClient).toHaveBeenCalled();
    });

    it("should prioritize Azure over AWS settings", () => {
      process.env.AZURE_STORAGE_CONNECTION_STRING = "azure-connection";
      process.env.STORAGE_TYPE = "s3";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "azure" });
      expect(AzureStorageClient).toHaveBeenCalled();
    });

    it("should default to DynamoDB when AWS_REGION is set", () => {
      process.env.AWS_REGION = "us-east-1";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "dynamodb" });
      expect(DynamoDBStorageClient).toHaveBeenCalled();
    });

    it("should default to DynamoDB when DYNAMODB_TABLE_NAME is set", () => {
      process.env.DYNAMODB_TABLE_NAME = "test-table";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "dynamodb" });
      expect(DynamoDBStorageClient).toHaveBeenCalled();
    });

    it("should fallback to DynamoDB when no configuration is detected", () => {
      // Clear all relevant env vars
      delete process.env.STORAGE_TYPE;
      delete process.env.AWS_REGION;
      delete process.env.DYNAMODB_TABLE_NAME;
      delete process.env.AZURE_STORAGE_CONNECTION_STRING;

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "dynamodb" });
      expect(DynamoDBStorageClient).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(
        "No storage configuration detected, defaulting to DynamoDB"
      );
    });

    it("should handle case-insensitive STORAGE_TYPE", () => {
      process.env.STORAGE_TYPE = "S3";

      const storage = StorageFactory.create();

      expect(storage).toEqual({ type: "s3" });
      expect(S3StorageClient).toHaveBeenCalled();
    });
  });

  describe("createByType()", () => {
    it("should create storage by explicit type", () => {
      const storage = StorageFactory.createByType(StorageType.S3);

      expect(storage).toEqual({ type: "s3" });
      expect(S3StorageClient).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("Creating storage client: s3");
    });

    it("should handle string type parameter", () => {
      const storage = StorageFactory.createByType("dynamodb");

      expect(storage).toEqual({ type: "dynamodb" });
      expect(DynamoDBStorageClient).toHaveBeenCalled();
    });

    it("should handle case-insensitive type", () => {
      const storage = StorageFactory.createByType("AZURE");

      expect(storage).toEqual({ type: "azure" });
      expect(AzureStorageClient).toHaveBeenCalled();
    });

    it("should throw error for unknown storage type", () => {
      expect(() => StorageFactory.createByType("unknown")).toThrow(
        "Unknown storage type: unknown. Available types: s3, dynamodb, azure"
      );
    });
  });

  describe("registerProvider()", () => {
    it("should register custom storage provider", () => {
      const customProvider = vi.fn().mockImplementation(() => ({ type: "custom" }));

      StorageFactory.registerProvider("custom", customProvider);

      const storage = StorageFactory.createByType("custom");

      expect(storage).toEqual({ type: "custom" });
      expect(customProvider).toHaveBeenCalled();
    });

    it("should register with case-insensitive key", () => {
      const customProvider = vi.fn().mockImplementation(() => ({ type: "custom" }));

      StorageFactory.registerProvider("CUSTOM", customProvider);

      const storage = StorageFactory.createByType("custom");

      expect(storage).toEqual({ type: "custom" });
    });

    it("should override existing provider", () => {
      const newS3Provider = vi.fn().mockImplementation(() => ({ type: "new-s3" }));

      StorageFactory.registerProvider("s3", newS3Provider);

      const storage = StorageFactory.createByType("s3");

      expect(storage).toEqual({ type: "new-s3" });
      expect(newS3Provider).toHaveBeenCalled();
    });
  });

  describe("getAvailableTypes()", () => {
    it("should return list of available storage types", () => {
      const types = StorageFactory.getAvailableTypes();

      expect(types).toContain("s3");
      expect(types).toContain("dynamodb");
      expect(types).toContain("azure");
    });

    it("should include custom registered types", () => {
      StorageFactory.registerProvider("custom", () => ({ type: "custom" }) as any);

      const types = StorageFactory.getAvailableTypes();

      expect(types).toContain("custom");
    });
  });
});
