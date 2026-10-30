import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromVite = createRequire(join(root, "node_modules/vite/package.json"));
const esbuild = requireFromVite("esbuild");

function walk(dir, suffix, found = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, suffix, found);
    else if (name.endsWith(suffix)) found.push(full);
  }
  return found;
}

const entryPoints = walk(join(root, "src"), ".test.ts");
if (entryPoints.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

const outdir = join(root, ".tmp-tests");
rmSync(outdir, { recursive: true, force: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints,
  bundle: true,
  platform: "node",
  format: "esm",
  outdir,
  outbase: join(root, "src"),
  external: ["node:*"],
  logLevel: "warning",
});

const bundled = walk(outdir, ".test.js");
const result = spawnSync(process.execPath, ["--test", ...bundled], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
