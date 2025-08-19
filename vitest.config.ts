import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
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
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
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
