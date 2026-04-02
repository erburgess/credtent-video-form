import { build } from "esbuild";
import { unlinkSync } from "fs";

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

// Remove the .ts source so @vercel/node uses our bundled .js directly
// (otherwise @vercel/node re-transpiles .ts and overwrites our bundle)
unlinkSync("api/index.ts");

console.log("✅ API function bundled to api/index.js");
