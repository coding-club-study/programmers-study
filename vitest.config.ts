import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "extension/**/*.test.ts", "dashboard/**/*.test.ts"],
    environment: "node"
  }
});
