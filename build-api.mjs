import { build } from "esbuild";

await build({
  entryPoints: ["api/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "api/index.js",
  banner: {
    js: "/* Bundled by esbuild for Vercel serverless */",
  },
});

console.log("✅ API function bundled to api/index.js");
