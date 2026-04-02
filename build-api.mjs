import { build } from "esbuild";
import { renameSync } from "fs";

// Rename .ts so @vercel/node won't re-transpile it and overwrite our bundle
renameSync("api/index.ts", "api/_source.ts");

await build({
  entryPoints: ["api/_source.ts"],
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
