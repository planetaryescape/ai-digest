#!/usr/bin/env bun
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

async function generateOGImage() {
  console.log("🎨 Generating Open Graph image...");

  const outputDir = path.join(__dirname, "../frontend/public");
  const outputPath = path.join(outputDir, "og-image.png");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create HTML content for the OG image
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      width: 1200px;
      height: 630px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      background: white;
      border-radius: 32px;
      padding: 60px 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      max-width: 1000px;
    }
    .logo-section {
      display: flex;
      align-items: center;
      margin-bottom: 40px;
    }
    .logo-icon {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      margin-right: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-text {
      font-size: 48px;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .headline {
      font-size: 56px;
      font-weight: bold;
      text-align: center;
      color: #1a202c;
      line-height: 1.2;
      margin-bottom: 30px;
    }
    .gradient-text {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 28px;
      color: #4a5568;
      text-align: center;
      margin-bottom: 40px;
    }
    .visual-section {
      display: flex;
      gap: 40px;
      align-items: center;
      margin-top: 20px;
    }
    .email-box {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .email-chaos {
      width: 200px;
      height: 140px;
      background: #f7fafc;
      border-radius: 12px;
      border: 2px solid #e2e8f0;
      padding: 12px;
      position: relative;
      overflow: hidden;
    }
    .email-clean {
      width: 200px;
      height: 140px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
      border-radius: 12px;
      border: 2px solid #667eea;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .email-line {
      height: 8px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .email-line-red { background: #fc8181; width: 100%; }
    .email-line-orange { background: #f6ad55; width: 90%; }
    .email-line-red-2 { background: #fc8181; width: 95%; }
    .email-line-orange-2 { background: #f6ad55; width: 85%; }
    .email-line-red-3 { background: #fc8181; width: 92%; }
    .email-line-orange-3 { background: #f6ad55; width: 88%; }
    .email-count {
      position: absolute;
      top: 8px;
      right: 8px;
      background: #fc8181;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 14px;
      font-weight: bold;
    }
    .clean-header {
      width: 100%;
      height: 20px;
      background: #667eea;
      border-radius: 6px;
    }
    .clean-content {
      width: 100%;
      height: 40px;
      background: rgba(102, 126, 234, 0.15);
      border-radius: 6px;
    }
    .label {
      font-size: 20px;
      color: #718096;
      margin-top: 12px;
    }
    .arrow {
      color: #667eea;
      font-size: 40px;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-section">
      <div class="logo-icon">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="13" x2="15" y2="13"></line>
          <line x1="9" y1="17" x2="11" y2="17"></line>
        </svg>
      </div>
      <span class="logo-text">AI Digest</span>
    </div>
    
    <div class="headline">
      Turn 50+ AI Newsletters Into<br>
      <span class="gradient-text">One Weekly Summary</span>
    </div>
    
    <div class="tagline">
      Save 3+ hours every week with intelligent AI-powered summaries
    </div>
    
    <div class="visual-section">
      <div class="email-box">
        <div class="email-chaos">
          <div class="email-line email-line-red"></div>
          <div class="email-line email-line-orange"></div>
          <div class="email-line email-line-red-2"></div>
          <div class="email-line email-line-orange-2"></div>
          <div class="email-line email-line-red-3"></div>
          <div class="email-line email-line-orange-3"></div>
          <div class="email-count">100+</div>
        </div>
        <span class="label">Before</span>
      </div>
      
      <div class="arrow">→</div>
      
      <div class="email-box">
        <div class="email-clean">
          <div class="clean-header"></div>
          <div class="clean-content"></div>
          <div class="clean-content"></div>
        </div>
        <span class="label">After</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
  });

  await page.setContent(htmlContent);
  await page.waitForTimeout(1000); // Wait for fonts to load

  await page.screenshot({
    path: outputPath,
    type: "png",
  });

  await browser.close();

  console.log(`✅ Open Graph image saved to: ${outputPath}`);
}

generateOGImage().catch((error) => {
  console.error("❌ Failed to generate OG image:", error);
  process.exit(1);
});
