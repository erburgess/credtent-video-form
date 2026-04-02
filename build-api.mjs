import { build } from "esbuild";

await build({
  entryPoints: ["server/api-entry.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/index.js",
  banner: {
    js: "/* Bundled by esbuild for Vercel serverless */",
  },
});

console.log("✅ API bundled: server/api-entry.ts → api/index.js");
