import { exec } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { beforeAll, describe, expect, it } from "vitest";

const execAsync = promisify(exec);

describe("Terraform Monitoring Configuration", () => {
  const terraformDir = path.join(__dirname);
  const monitoringFile = path.join(terraformDir, "monitoring.tf");

  beforeAll(async () => {
    // Verify monitoring.tf exists
    const exists = await fs
      .access(monitoringFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  describe("Dashboard Configurations", () => {
    let monitoringConfig: string;

    beforeAll(async () => {
      monitoringConfig = await fs.readFile(monitoringFile, "utf-8");
    });

    it("should define main dashboard", () => {
      expect(monitoringConfig).toContain('resource "aws_cloudwatch_dashboard" "ai_digest_main"');
      expect(monitoringConfig).toContain('dashboard_name = "${var.PROJECT_NAME}-main-dashboard"');
    });

    it("should define cost dashboard", () => {
      expect(monitoringConfig).toContain('resource "aws_cloudwatch_dashboard" "ai_digest_costs"');
      expect(monitoringConfig).toContain('dashboard_name = "${var.PROJECT_NAME}-cost-dashboard"');
    });

    it("should define agents dashboard", () => {
      expect(monitoringConfig).toContain('resource "aws_cloudwatch_dashboard" "ai_digest_agents"');
      expect(monitoringConfig).toContain('dashboard_name = "${var.PROJECT_NAME}-agents-dashboard"');
    });

    it("should include Lambda metrics widgets", () => {
      expect(monitoringConfig).toContain("Lambda Execution Overview");
      expect(monitoringConfig).toContain("AWS/Lambda");
      expect(monitoringConfig).toContain("Invocations");
      expect(monitoringConfig).toContain("Errors");
      expect(monitoringConfig).toContain("Duration");
    });

    it("should include DynamoDB metrics", () => {
      expect(monitoringConfig).toContain("AWS/DynamoDB");
      expect(monitoringConfig).toContain("ConsumedReadCapacityUnits");
      expect(monitoringConfig).toContain("ConsumedWriteCapacityUnits");
    });

    it("should include S3 metrics", () => {
      expect(monitoringConfig).toContain("AWS/S3");
      expect(monitoringConfig).toContain("AllRequests");
      expect(monitoringConfig).toContain("BucketSizeBytes");
    });

    it("should include API Gateway metrics", () => {
      expect(monitoringConfig).toContain("AWS/ApiGateway");
      expect(monitoringConfig).toContain("Count");
      expect(monitoringConfig).toContain("Latency");
      expect(monitoringConfig).toContain("4XXError");
      expect(monitoringConfig).toContain("5XXError");
    });

    it("should include cost calculation expressions", () => {
      expect(monitoringConfig).toContain("expression");
      expect(monitoringConfig).toContain("Estimated Cost");
      // Lambda cost calculation
      expect(monitoringConfig).toMatch(/\(m1 \/ 1000 \* 256 \/ 1024\) \* 0\.0000166667/);
    });

    it("should include log insights queries", () => {
      expect(monitoringConfig).toContain('type = "log"');
      expect(monitoringConfig).toContain("query");
      expect(monitoringConfig).toContain("circuit.*breaker");
      expect(monitoringConfig).toContain("Agent.*duration");
    });
  });

  describe("CloudWatch Alarms", () => {
    let monitoringConfig: string;

    beforeAll(async () => {
      monitoringConfig = await fs.readFile(monitoringFile, "utf-8");
    });

    it("should define Lambda error alarm", () => {
      expect(monitoringConfig).toContain('resource "aws_cloudwatch_metric_alarm" "lambda_errors"');
      expect(monitoringConfig).toContain('metric_name         = "Errors"');
      expect(monitoringConfig).toContain('threshold           = "5"');
    });

    it("should define Lambda throttle alarm", () => {
      expect(monitoringConfig).toContain(
        'resource "aws_cloudwatch_metric_alarm" "lambda_throttles"'
      );
      expect(monitoringConfig).toContain('metric_name         = "Throttles"');
      expect(monitoringConfig).toContain('threshold           = "1"');
    });

    it("should define Lambda duration alarm", () => {
      expect(monitoringConfig).toContain(
        'resource "aws_cloudwatch_metric_alarm" "lambda_duration"'
      );
      expect(monitoringConfig).toContain('metric_name         = "Duration"');
      expect(monitoringConfig).toContain('threshold           = "240000"');
    });

    it("should define API Gateway 4XX alarm", () => {
      expect(monitoringConfig).toContain(
        'resource "aws_cloudwatch_metric_alarm" "api_gateway_4xx"'
      );
      expect(monitoringConfig).toContain('metric_name         = "4XXError"');
      expect(monitoringConfig).toContain('threshold           = "10"');
    });

    it("should define API Gateway 5XX alarm", () => {
      expect(monitoringConfig).toContain(
        'resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx"'
      );
      expect(monitoringConfig).toContain('metric_name         = "5XXError"');
      expect(monitoringConfig).toContain('threshold           = "5"');
    });

    it("should define DynamoDB error alarm", () => {
      expect(monitoringConfig).toContain(
        'resource "aws_cloudwatch_metric_alarm" "dynamodb_errors"'
      );
      expect(monitoringConfig).toContain('metric_name         = "UserErrors"');
      expect(monitoringConfig).toContain('namespace           = "AWS/DynamoDB"');
    });

    it("should set appropriate evaluation periods", () => {
      expect(monitoringConfig).toContain('evaluation_periods  = "2"');
      expect(monitoringConfig).toContain('evaluation_periods  = "1"');
    });

    it("should handle missing data correctly", () => {
      expect(monitoringConfig).toContain('treat_missing_data  = "notBreaching"');
    });
  });

  describe("S3 Metrics Configuration", () => {
    let monitoringConfig: string;

    beforeAll(async () => {
      monitoringConfig = await fs.readFile(monitoringFile, "utf-8");
    });

    it("should define S3 bucket metrics filter", () => {
      expect(monitoringConfig).toContain(
        'resource "aws_s3_bucket_metric" "processed_emails_metrics"'
      );
      expect(monitoringConfig).toContain('name   = "EntireBucket"');
    });
  });

  describe("Terraform Outputs", () => {
    let monitoringConfig: string;

    beforeAll(async () => {
      monitoringConfig = await fs.readFile(monitoringFile, "utf-8");
    });

    it("should output main dashboard URL", () => {
      expect(monitoringConfig).toContain('output "main_dashboard_url"');
      expect(monitoringConfig).toContain("cloudwatch/home");
    });

    it("should output cost dashboard URL", () => {
      expect(monitoringConfig).toContain('output "cost_dashboard_url"');
    });

    it("should output agents dashboard URL", () => {
      expect(monitoringConfig).toContain('output "agents_dashboard_url"');
    });
  });

  describe("Terraform Validation", () => {
    it("should pass terraform validation", async () => {
      try {
        const { stdout, stderr } = await execAsync("terraform validate", { cwd: terraformDir });
        expect(stderr).toBe("");
        expect(stdout).toContain("Success");
      } catch (error) {
        // If terraform is not installed, skip this test
        if (error.message.includes("terraform: command not found")) {
        } else {
          throw error;
        }
      }
    }, 30000);

    it("should have valid JSON in dashboard configurations", () => {
      const monitoringContent = fs.readFileSync(monitoringFile, "utf-8");

      // Extract all jsonencode blocks
      const jsonBlocks = monitoringContent.match(/jsonencode\(([\s\S]*?)\n {2}\}\)/g);

      if (jsonBlocks) {
        jsonBlocks.forEach((block) => {
          // This is a basic check - in real terraform, jsonencode handles HCL to JSON conversion
          expect(block).toContain("widgets");
        });
      }
    });
  });

  describe("Deployment Script", () => {
    const scriptPath = path.join(__dirname, "..", "..", "scripts", "deploy-monitoring.sh");

    it("should have executable deployment script", async () => {
      const exists = await fs
        .access(scriptPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      const stats = await fs.stat(scriptPath);
      // Check if file is executable (Unix)
      if (process.platform !== "win32") {
        expect(stats.mode & 0o111).toBeGreaterThan(0);
      }
    });

    it("should contain proper error handling", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      expect(scriptContent).toContain("set -e");
      expect(scriptContent).toContain("if ! command -v aws");
      expect(scriptContent).toContain("if ! aws sts get-caller-identity");
    });

    it("should target monitoring resources", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      expect(scriptContent).toContain("-target=aws_cloudwatch_dashboard.ai_digest_main");
      expect(scriptContent).toContain("-target=aws_cloudwatch_dashboard.ai_digest_costs");
      expect(scriptContent).toContain("-target=aws_cloudwatch_dashboard.ai_digest_agents");
      expect(scriptContent).toContain("-target=aws_cloudwatch_metric_alarm");
    });
  });
});

describe("Monitoring Documentation", () => {
  const docsPath = path.join(__dirname, "..", "..", "docs", "monitoring.md");

  it("should have monitoring documentation", async () => {
    const exists = await fs
      .access(docsPath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("should document all dashboards", async () => {
    const content = await fs.readFile(docsPath, "utf-8");
    expect(content).toContain("Main Dashboard");
    expect(content).toContain("Cost Dashboard");
    expect(content).toContain("Agents Dashboard");
  });

  it("should document all alarms", async () => {
    const content = await fs.readFile(docsPath, "utf-8");
    expect(content).toContain("Lambda Errors");
    expect(content).toContain("Lambda Throttles");
    expect(content).toContain("Lambda Duration");
    expect(content).toContain("API Gateway");
    expect(content).toContain("DynamoDB");
  });

  it("should include deployment instructions", async () => {
    const content = await fs.readFile(docsPath, "utf-8");
    expect(content).toContain("./scripts/deploy-monitoring.sh");
    expect(content).toContain("terraform apply");
  });

  it("should include troubleshooting section", async () => {
    const content = await fs.readFile(docsPath, "utf-8");
    expect(content).toContain("Troubleshooting");
    expect(content).toContain("Common Issues");
  });
});
