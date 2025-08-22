import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov", "json-summary"],
      exclude: [
        "node_modules/**",
        "test/**",
        "scripts/**",
        "terraform/**",
        "emails/**",
        "*.config.ts",
        "*.config.js",
        "bin/**",
        "**/types.ts",
        "**/interfaces/**",
        "dist/**",
        "coverage/**",
      ],
      thresholds: {
        global: {
          statements: 50,
          branches: 50,
          functions: 50,
          lines: 50,
        },
        "functions/core/digest-processor.ts": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        "functions/lib/agents/*.ts": {
          statements: 75,
          branches: 75,
          functions: 75,
          lines: 75,
        },
        "functions/handlers/**/*.ts": {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
        "functions/lib/*.ts": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
      },
    },
    include: ["functions/**/*.{test,spec}.{ts,tsx}", "test/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "terraform/**", "frontend/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./functions"),
      "@lib": path.resolve(__dirname, "./functions/lib"),
      "@core": path.resolve(__dirname, "./functions/core"),
      "@handlers": path.resolve(__dirname, "./functions/handlers"),
    },
  },
});
