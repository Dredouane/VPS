import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "scripts/__tests__/**/*.test.ts",
      "apps/web/src/lib/__tests__/**/*.test.ts",
    ],
    environment: "node",
  },
});
