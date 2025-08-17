import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
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
      ],
    },
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", "terraform/**"],
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
