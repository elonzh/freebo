import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(join(root, ".integration"), { recursive: true });
const output = join(root, ".integration/runner.mjs");
await build({
  entryPoints: [join(root, "scripts/integration/runner.ts")],
  outfile: output,
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  target: "node22",
});
const { run } = await import(pathToFileURL(output).href);
await run(root, process.argv[2]);
