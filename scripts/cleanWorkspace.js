import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const removedPaths = [];

function removePath(targetPath) {
  const relative = path.relative(repoRoot, path.resolve(targetPath));
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Cleanup target is outside the backend workspace: ${targetPath}`);
  }
  if (!existsSync(targetPath)) {
    return;
  }

  rmSync(targetPath, { recursive: true, force: true });
  removedPaths.push(path.relative(repoRoot, targetPath).replaceAll("\\", "/"));
}

function removeDirectChildren(parentDir, matcher) {
  if (!existsSync(parentDir)) {
    return;
  }

  for (const entry of readdirSync(parentDir)) {
    if (matcher(entry)) {
      removePath(path.join(parentDir, entry));
    }
  }
}

// Retain installed runtimes, weights and ownership of any running model worker.
const persistentCaches = new Set(["gliclass-model", "gliclass-hub", "gliclass-runtime", "scraper-actions", "description-rewriter"]);
removeDirectChildren(path.join(repoRoot, ".cache"), name => !persistentCaches.has(name));
removePath(path.join(repoRoot, "coverage"));
removePath(path.join(repoRoot, "node_modules", ".cache"));
removePath(path.join(repoRoot, "playwright-report"));
removePath(path.join(repoRoot, "test-results"));
removePath(path.join(repoRoot, "tmp"));
removePath(path.join(repoRoot, "scraper", "archive"));

removeDirectChildren(repoRoot, (entryName) => /^tmp-.*\.js$/i.test(entryName));
removeDirectChildren(path.join(repoRoot, "scraper-support", "tests", "fixtures"), (entryName) =>
  /^tmp/i.test(entryName)
);

const scraperDir = path.join(repoRoot, "scraper");
if (existsSync(scraperDir)) {
  for (const entry of readdirSync(scraperDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    removePath(path.join(scraperDir, entry.name, "jobs.json"));
  }
}

if (removedPaths.length === 0) {
  console.log("Workspace already clean.");
} else {
  console.log("Removed workspace artifacts:");
  for (const removedPath of removedPaths.sort()) {
    console.log(`- ${removedPath}`);
  }
}
