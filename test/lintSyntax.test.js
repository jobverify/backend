import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/lintSyntax.js", import.meta.url));
test("syntax validation includes maintenance ES modules and ignores fixture snippets", () => {
  const root = mkdtempSync(path.join(tmpdir(), "jobverify-lint-"));
  try {
    writeFileSync(path.join(root, "package.json"), '{"type":"module"}');
    writeFileSync(path.join(root, "valid.js"), "export const valid = true;");
    mkdirSync(path.join(root, "fixtures"));
    writeFileSync(path.join(root, "fixtures", "partial.js"), "const =");
    let result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    writeFileSync(path.join(root, "broken.mjs"), "export const = ;");
    result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 1, "An invalid maintenance ES module must fail syntax validation");
    assert.match(result.stderr, /broken\.mjs/);
  } finally {
    assert.equal(path.dirname(root), tmpdir());
    rmSync(root, { recursive: true, force: true });
  }
});
