import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
  process.env.VITE_BASE_PATH ??
  (process.env.GITHUB_ACTIONS === "true" && repositoryName ? `/${repositoryName}/` : "/");

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: "dist"
  }
});
