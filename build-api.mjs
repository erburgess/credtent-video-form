import { build } from "esbuild";

await build({
  entryPoints: ["api/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "api/index.mjs",
  external: [],
  banner: {
    js: `
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
`,
  },
});

console.log("✅ API function bundled to api/index.mjs");
