import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("local job profiling harness runs against a real temporary MongoDB instance", async (t) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "jobverify-job-profile-test-"));

  try {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/profileLocalJobQueries.js",
        "--total-jobs=1800",
        "--repeat=1",
        `--output-dir=${outputDir}`,
      ],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        timeout: 20 * 60 * 1000,
      },
    );

    const outputText = `${result.stderr || ""}\n${result.stdout || ""}`;
    if (
      result.status !== 0
      && /(Could NOT download|DownloadError|ETIMEDOUT|fastdl\.mongodb\.org)/i.test(outputText)
    ) {
      t.skip("mongodb-memory-server binary download is unavailable in this environment");
      return;
    }

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const lines = String(result.stdout || "").trim().split(/\r?\n/);
    const startIndex = lines.findIndex((line) => line.trim() === "{");
    const payload = JSON.parse(lines.slice(startIndex).join("\n"));
    assert.ok(fs.existsSync(payload.summaryPath));
    assert.ok(fs.existsSync(payload.indexArtifacts.planBefore));
    assert.ok(fs.existsSync(payload.indexArtifacts.planAfter));

    const beforeReport = JSON.parse(fs.readFileSync(payload.beforeArtifacts.jsonPath, "utf8"));
    const afterReport = JSON.parse(fs.readFileSync(payload.afterArtifacts.jsonPath, "utf8"));
    const latestCase = afterReport.cases.find((item) => item.name === "jobs.latest.unfiltered");
    const textCase = afterReport.cases.find((item) => item.name === "jobs.text");

    assert.equal(beforeReport.dataset.totalJobs, 1800);
    assert.equal(afterReport.dataset.totalJobs, 1800);
    assert.ok(latestCase);
    assert.ok(textCase);
    assert.equal(typeof latestCase.explain.executionTimeMillis, "number");
    assert.ok(Array.isArray(textCase.explain.indexNames));
    assert.ok(textCase.explain.indexNames.length > 0);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
