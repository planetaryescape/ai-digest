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
  } catch (_error) {
    // Don't exit on individual failures, continue with other functions
  }
};

const createDeploymentPackage = () => {
  const packagePath = path.join(outputDir, "..", "lambda-stepfunctions.zip");

  // Remove old package if exists
  if (fs.existsSync(packagePath)) {
    fs.unlinkSync(packagePath);
  }

  // Check if output directory has any files
  if (!fs.existsSync(outputDir) || fs.readdirSync(outputDir).length === 0) {
    return;
  }

  // Create zip file with all Step Functions Lambda functions
  const zipCommand = `cd ${outputDir} && zip -r ../lambda-stepfunctions.zip . -q`;
  execSync(zipCommand);

  // Get package size
  const stats = fs.statSync(packagePath);
  const fileSizeInMB = stats.size / (1024 * 1024);

  if (fileSizeInMB > 50) {
  }
};

// Run all builds in parallel but wait for them to complete
const main = async () => {
  try {
    // Check if we have any handlers to build
    const existingHandlers = stepFunctionLambdas.filter((config) => {
      const entryFile = path.join(handlersDir, config.handler);
      return fs.existsSync(entryFile);
    });

    if (existingHandlers.length === 0) {
      return;
    }

    await Promise.all(existingHandlers.map(buildFunction));
    createDeploymentPackage();
  } catch (_error) {
    process.exit(1);
  }
};

main();
