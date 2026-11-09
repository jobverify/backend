import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// One parser process handles the catalog's thousands of modules. Parsing never
// links imports or executes source code. The VM flag is isolated to this check.
if (!vm.SourceTextModule) {
  const child = spawnSync(process.execPath, [
    "--experimental-vm-modules",
    "--disable-warning=ExperimentalWarning",
    fileURLToPath(import.meta.url),
  ], { cwd: process.cwd(), stdio: "inherit", windowsHide: true });
  if (child.error) console.error(child.error.message);
  process.exit(child.status ?? 1);
}

const root = process.cwd();
const ignoredDirs = new Set([
  "node_modules", ".git", ".cache", ".codex", ".superpowers",
  "coverage", "dist", "fixtures", "playwright-report", "test-results", "tmp",
]);

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !ignoredDirs.has(entry.name)) {
      yield* sourceFiles(fullPath);
    } else if (entry.isFile() && /\.(?:js|mjs|cjs)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}

let checked = 0;
for (const file of sourceFiles(root)) {
  try {
    const source = readFileSync(file, "utf8");
    if (file.endsWith(".cjs")) new vm.Script(source, { filename: file });
    else new vm.SourceTextModule(source, { identifier: file });
    checked += 1;
  } catch (error) {
    console.error(`${path.relative(root, file)}: ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`Checked syntax for ${checked} JavaScript files.`);
