import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/tests/**/*.test.ts", "packages/*/tests/**/*.test.tsx"],
    environment: "jsdom",
    globals: true,
    alias: {
      "@roleforge/domain": new URL(
        "./packages/domain/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
});
