/* eslint-disable @typescript-eslint/no-require-imports */
const { sentryEsbuildPlugin } = require("@sentry/esbuild-plugin");
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const handlersDir = path.resolve(__dirname, "../functions/handlers/stepfunctions");
const outputDir = path.resolve(__dirname, "../terraform/artifacts/stepfunctions");

// Step Functions Lambda configurations
const stepFunctionLambdas = [
  { name: "email-fetcher", handler: "email-fetcher.ts" },
  { name: "classifier", handler: "classifier.ts" },
  { name: "content-extractor", handler: "content-extractor.ts" },
  { name: "research", handler: "research.ts" },
  { name: "analysis", handler: "analysis.ts" },
  { name: "critic", handler: "critic.ts" },
  { name: "digest-sender", handler: "digest-sender.ts" },
  { name: "error-handler", handler: "error-handler.ts" },
];

const buildFunction = async (config) => {
  const entryFile = path.join(handlersDir, config.handler);
  const outdir = outputDir;

  // Create output directory
  fs.mkdirSync(outdir, { recursive: true });

  // Check if the handler file exists
  if (!fs.existsSync(entryFile)) {
    console.warn(`⚠️  Warning: Handler file not found: ${entryFile}`);
    console.warn(`   Creating placeholder for ${config.name}`);
    // For now, skip if file doesn't exist
    return;
  }

  try {
    const plugins = [];

    // Only add Sentry plugin if auth token is available
    if (process.env.SENTRY_AUTH_TOKEN) {
      plugins.push(
        sentryEsbuildPlugin({
          org: "ai-digest",
          project: `sf-${config.name}`,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })
      );
    }

    const outfile = path.join(outdir, `${config.name}.js`);

    await esbuild.build({
      entryPoints: [entryFile],
      outfile,
      bundle: true,
      minify: false, // Keep readable for debugging
      sourcemap: true,
      platform: "node",
      target: "node20", // AWS Lambda Node.js 20.x runtime
      format: "cjs", // CommonJS format for Lambda
      inject: [path.join(__dirname, "react-shim.js")],
      loader: {
        ".ts": "tsx",
        ".tsx": "tsx",
        ".node": "file",
      },
      plugins,
      external: [
        "aws-sdk", // AWS SDK v2 is provided by Lambda runtime
        "@aws-sdk/*", // AWS SDK v3 modules should be bundled
        "pino-pretty", // Dev dependency
      ],
    });

    console.log(`✅ Built Step Functions Lambda: ${config.name}`);
  } catch (error) {
    console.error(`❌ Failed to build Step Functions Lambda: ${config.name}`, error);
    // Don't exit on individual failures, continue with other functions
  }
};

const createDeploymentPackage = () => {
  console.log("📦 Creating Step Functions Lambda deployment package...");

  const packagePath = path.join(outputDir, "..", "lambda-stepfunctions.zip");

  // Remove old package if exists
  if (fs.existsSync(packagePath)) {
    fs.unlinkSync(packagePath);
  }

  // Check if output directory has any files
  if (!fs.existsSync(outputDir) || fs.readdirSync(outputDir).length === 0) {
    console.warn("⚠️  No Lambda functions built for Step Functions");
    return;
  }

  // Create zip file with all Step Functions Lambda functions
  const zipCommand = `cd ${outputDir} && zip -r ../lambda-stepfunctions.zip . -q`;
  execSync(zipCommand);

  console.log(`✅ Created deployment package: ${packagePath}`);

  // Get package size
  const stats = fs.statSync(packagePath);
  const fileSizeInMB = stats.size / (1024 * 1024);
  console.log(`📊 Package size: ${fileSizeInMB.toFixed(2)} MB`);

  if (fileSizeInMB > 50) {
    console.warn("⚠️  Warning: Package is larger than 50MB. Consider using Lambda Layers.");
  }
};

// Run all builds in parallel but wait for them to complete
const main = async () => {
  console.log("🔨 Building Step Functions Lambda handlers...");
  console.log("📁 Looking for handlers in:", handlersDir);

  try {
    // Check if we have any handlers to build
    const existingHandlers = stepFunctionLambdas.filter((config) => {
      const entryFile = path.join(handlersDir, config.handler);
      return fs.existsSync(entryFile);
    });

    if (existingHandlers.length === 0) {
      console.warn("⚠️  No Step Functions handlers found to build");
      console.log("   Expected location: functions/handlers/stepfunctions/");
      console.log("   You may need to create the handler files first");
      return;
    }

    await Promise.all(existingHandlers.map(buildFunction));
    createDeploymentPackage();
    console.log("✅ Step Functions Lambda build completed");
  } catch (error) {
    console.error("❌ Build failed", error);
    process.exit(1);
  }
};

main();
