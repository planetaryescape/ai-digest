/* eslint-disable @typescript-eslint/no-require-imports */
const { sentryEsbuildPlugin } = require("@sentry/esbuild-plugin");
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const functionsDir = path.resolve(__dirname, "../functions");
const terraformDir = path.resolve(__dirname, "../terraform");

const directoriesToExclude = ["lib", "emails"];

const functions = fs.readdirSync(functionsDir).filter((file) => {
  if (directoriesToExclude.includes(file)) {
    return false;
  }
  const fullPath = path.join(functionsDir, file);
  return fs.statSync(fullPath).isDirectory();
});

const buildService = async (functionName) => {
  const functionPath = path.join(functionsDir, functionName);
  const entryFile = path.join(functionPath, "index.ts");
  const outdir = path.join(terraformDir, "artifacts", functionName);

  // Create output directory
  fs.mkdirSync(outdir, { recursive: true });

  try {
    const plugins = [];

    // Only add Sentry plugin if auth token is available
    if (process.env.SENTRY_AUTH_TOKEN) {
      plugins.push(
        sentryEsbuildPlugin({
          org: "ai-digest",
          project: functionName,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })
      );
    }

    await esbuild.build({
      entryPoints: [entryFile],
      outfile: path.join(outdir, "index.js"),
      bundle: true,
      minify: false, // Don't minify to avoid breaking Azure Functions context
      sourcemap: true,
      platform: "node",
      target: "node22",
      inject: [path.join(__dirname, "react-shim.js")],
      loader: {
        ".ts": "tsx",
        ".tsx": "tsx",
        ".node": "file",
      },
      plugins,
      external: ["pino-pretty"], // Exclude pino-pretty from bundle (dev only)
    });

    // Copy function.json
    const functionJsonSrc = path.join(functionPath, "function.json");
    const functionJsonDst = path.join(outdir, "function.json");
    if (fs.existsSync(functionJsonSrc)) {
      fs.copyFileSync(functionJsonSrc, functionJsonDst);
    }
  } catch (_error) {
    process.exit(1);
  }
};

// Run all builds in parallel but wait for them to complete
const main = async () => {
  try {
    await Promise.all(functions.map(buildService));
  } catch (_error) {
    process.exit(1);
  }
};

main();
