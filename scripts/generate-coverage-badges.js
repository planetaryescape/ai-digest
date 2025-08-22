#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getBadgeColor(percentage) {
  if (percentage >= 80) {
    return "brightgreen";
  }
  if (percentage >= 60) {
    return "yellow";
  }
  if (percentage >= 40) {
    return "orange";
  }
  return "red";
}

function generateBadge(label, percentage) {
  const color = getBadgeColor(percentage);
  return `![${label}](https://img.shields.io/badge/${label}-${percentage.toFixed(1)}%25-${color})`;
}

function updateReadmeBadges() {
  const coverageSummaryPath = path.join(__dirname, "..", "coverage", "coverage-summary.json");
  const readmePath = path.join(__dirname, "..", "README.md");

  if (!fs.existsSync(coverageSummaryPath)) {
    return;
  }

  const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, "utf8"));
  const total = coverageSummary.total;

  const badges = [
    generateBadge("statements", total.statements.pct),
    generateBadge("branches", total.branches.pct),
    generateBadge("functions", total.functions.pct),
    generateBadge("lines", total.lines.pct),
  ];

  let readme = fs.readFileSync(readmePath, "utf8");

  // Replace badges one by one
  const badgeTypes = ["statements", "branches", "functions", "lines"];
  
  badgeTypes.forEach((type, index) => {
    const regex = new RegExp(`!\\[.*?\\]\\(https://img\\.shields\\.io/badge/.*?${type}.*?\\)`, "g");
    readme = readme.replace(regex, badges[index]);
  });

  fs.writeFileSync(readmePath, readme);
}

updateReadmeBadges();
