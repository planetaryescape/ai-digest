#!/usr/bin/env bun

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const terraformDir = path.resolve((import.meta as any).dir || process.cwd(), "../terraform");
const artifactsDir = path.join(terraformDir, "artifacts");
const packageZip = path.join(terraformDir, "package.zip");

// Check if artifacts directory exists
if (!fs.existsSync(artifactsDir)) {
  process.exit(1);
}

// Copy host.json to terraform directory (it needs to be at the root of the zip)
const hostJsonSrc = path.join((import.meta as any).dir || process.cwd(), "../host.json");
const hostJsonDst = path.join(terraformDir, "host.json");
if (fs.existsSync(hostJsonSrc)) {
  fs.copyFileSync(hostJsonSrc, hostJsonDst);
}

// Remove existing package.zip if it exists
if (fs.existsSync(packageZip)) {
  fs.rmSync(packageZip);
}

// Create the zip file with correct structure (functions at root level)
try {
  // Change to artifacts directory and zip contents at root level
  execSync(
    `cd "${artifactsDir}" && zip -r "${packageZip}" . && cd "${terraformDir}" && zip -u package.zip host.json`,
    {
      stdio: "inherit",
    }
  );

  // Clean up temporary host.json
  if (fs.existsSync(hostJsonDst)) {
    fs.rmSync(hostJsonDst);
  }
} catch (_error) {
  process.exit(1);
}
