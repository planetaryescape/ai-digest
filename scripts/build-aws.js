/* eslint-disable @typescript-eslint/no-require-imports */
let sentryEsbuildPlugin;
try {
  sentryEsbuildPlugin = require("@sentry/esbuild-plugin").sentryEsbuildPlugin;
} catch (_e) {}
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const handlersDir = path.resolve(__dirname, "../functions/handlers/aws");
const outputDir = path.resolve(__dirname, "../terraform/artifacts/aws");

// Lambda function configurations
const lambdaFunctions = [
  { name: "weekly-digest", handler: "weekly-digest.ts" },
  { name: "run-now", handler: "run-now.ts" },
];

const buildFunction = async (config) => {
  const entryFile = path.join(handlersDir, config.handler);
  const outdir = outputDir; // Build directly in outputDir, not subdirectory

  // Create output directory
  fs.mkdirSync(outdir, { recursive: true });

  try {
    const plugins = [];

    // Only add Sentry plugin if auth token is available and plugin is loaded
    if (process.env.SENTRY_AUTH_TOKEN && sentryEsbuildPlugin) {
      plugins.push(
        sentryEsbuildPlugin({
          org: "ai-digest",
          project: config.name,
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
        "pino-pretty", // Dev dependency
      ],
    });

    // Post-process to check if handler needs to be exported
    // esbuild should handle this with proper format, but check just in case
    const content = fs.readFileSync(outfile, "utf8");

    // Check if exports.handler or module.exports is already present
    if (!content.includes("exports.handler") && !content.includes("exports = {")) {
    }
  } catch (_error) {
    process.exit(1);
  }
};

const createDeploymentPackage = () => {
  const packagePath = path.join(outputDir, "..", "lambda.zip");

  // Remove old package if exists
  if (fs.existsSync(packagePath)) {
    fs.unlinkSync(packagePath);
  }

  // Copy package.json for Lambda layer (optional)
  const packageJsonSrc = path.join(handlersDir, "package.json");
  const packageJsonDst = path.join(outputDir, "package.json");
  if (fs.existsSync(packageJsonSrc)) {
    fs.copyFileSync(packageJsonSrc, packageJsonDst);
  }

  // Create zip file with all Lambda functions
  const zipCommand = `cd ${outputDir} && zip -r ../lambda.zip . -q`;
  execSync(zipCommand);
};

// Run all builds in parallel but wait for them to complete
const main = async () => {
  try {
    await Promise.all(lambdaFunctions.map(buildFunction));
    createDeploymentPackage();
  } catch (_error) {
    process.exit(1);
  }
};

main();
