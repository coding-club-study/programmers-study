import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const dist = path.join(directory, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(directory, "manifest.json"), path.join(dist, "manifest.json"));
const galmuriDirectory = path.dirname(fileURLToPath(import.meta.resolve("galmuri/dist/galmuri.css")));
await mkdir(path.join(dist, "fonts"), { recursive: true });
await cp(path.join(galmuriDirectory, "Galmuri11.woff2"), path.join(dist, "fonts", "Galmuri11.woff2"));

await viteBuild({
  root: directory,
  configFile: false,
  publicDir: false,
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: "chrome120",
    rollupOptions: { input: path.join(directory, "popup.html") }
  }
});

const common = {
  bundle: true,
  sourcemap: true,
  minify: false,
  target: "chrome120",
  logLevel: "info"
};

if (watch) {
  const { context } = await import("esbuild");
  const content = await context({ ...common, entryPoints: [path.join(directory, "src/content-script.ts")], outfile: path.join(dist, "content-script.js"), format: "iife" });
  const worker = await context({ ...common, entryPoints: [path.join(directory, "src/service-worker.ts")], outfile: path.join(dist, "service-worker.js"), format: "esm" });
  await Promise.all([content.watch(), worker.watch()]);
  console.log("Watching extension sources. Rebuild popup manually after popup changes.");
} else {
  await Promise.all([
    esbuild({ ...common, entryPoints: [path.join(directory, "src/content-script.ts")], outfile: path.join(dist, "content-script.js"), format: "iife" }),
    esbuild({ ...common, entryPoints: [path.join(directory, "src/service-worker.ts")], outfile: path.join(dist, "service-worker.js"), format: "esm" })
  ]);
}
