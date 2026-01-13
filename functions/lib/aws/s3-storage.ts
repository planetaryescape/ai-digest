import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { IStorageClient } from "../interfaces/storage";
import type { ProcessedEmail } from "../types";

export class S3StorageClient implements IStorageClient {
  private s3: S3Client;
  private bucketName: string;

  constructor() {
    this.s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
    this.bucketName = process.env.S3_BUCKET || "ai-digest-processed-emails";
  }

  async markProcessed(emailId: string, subject: string): Promise<void> {
    const weekStart = this.getWeekStart();
    const key = `processed/${weekStart}/${emailId}.json`;

    const data: ProcessedEmail = {
      id: emailId,
      subject,
      processedAt: new Date().toISOString(),
    };

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: JSON.stringify(data),
        ContentType: "application/json",
      })
    );
  }

  async markMultipleProcessed(emails: Array<{ id: string; subject: string }>): Promise<void> {
    const promises = emails.map((email) => this.markProcessed(email.id, email.subject));
    await Promise.all(promises);
  }

  async getWeeklyProcessedIds(): Promise<string[]> {
    const weekStart = this.getWeekStart();
    const prefix = `processed/${weekStart}/`;

    try {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
        })
      );

      if (!response.Contents) {
        return [];
      }

      return response.Contents.map((obj) => {
        const key = obj.Key || "";
        const filename = key.split("/").pop() || "";
        return filename.replace(".json", "");
      }).filter((id) => id);
    } catch (error) {
      console.error("Error listing processed emails:", error);
      return [];
    }
  }

  async getAllProcessed(): Promise<ProcessedEmail[]> {
    try {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: "processed/",
        })
      );

      if (!response.Contents) {
        return [];
      }

      const emails: ProcessedEmail[] = [];
      for (const obj of response.Contents) {
        if (obj.Key) {
          try {
            const data = await this.s3.send(
              new GetObjectCommand({
                Bucket: this.bucketName,
                Key: obj.Key,
              })
            );
            if (data.Body) {
              const bodyString = await data.Body.transformToString();
              emails.push(JSON.parse(bodyString));
            }
          } catch (error) {
            console.error(`Error reading processed email ${obj.Key}:`, error);
          }
        }
      }
      return emails;
    } catch (error) {
      console.error("Error getting all processed emails:", error);
      return [];
    }
  }

  async getAllProcessedIds(): Promise<string[]> {
    try {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: "processed/",
        })
      );

      if (!response.Contents) {
        return [];
      }

      return response.Contents.map((obj) => {
        const key = obj.Key || "";
        const filename = key.split("/").pop() || "";
        return filename.replace(".json", "");
      }).filter((id) => id);
    } catch (error) {
      console.error("Error listing all processed email IDs:", error);
      return [];
    }
  }

  async isProcessed(emailId: string): Promise<boolean> {
    const weekStart = this.getWeekStart();
    const key = `processed/${weekStart}/${emailId}.json`;

    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanupOldRecords(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const response = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: "processed/",
        })
      );

      if (!response.Contents) {
        return 0;
      }

      const oldObjects = response.Contents.filter((obj) => {
        if (!obj.LastModified) return false;
        return obj.LastModified < cutoffDate;
      });

      let deletedCount = 0;
      for (const obj of oldObjects) {
        if (obj.Key) {
          await this.s3.send(
            new DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: obj.Key,
            })
          );
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up old records:", error);
      return 0;
    }
  }

  async clearOldProcessedEmails(): Promise<void> {
    await this.cleanupOldRecords(30);
  }

  private getWeekStart(): string {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const diff = now.getUTCDate() - dayOfWeek;
    const weekStart = new Date(now.setUTCDate(diff));
    weekStart.setUTCHours(0, 0, 0, 0);
    return weekStart.toISOString().split("T")[0];
  }
}
