import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditJobLinks,
  getRetryableJobCandidatesFromReport,
} from "./lib/jobLinkAudit.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceArtifactsDir = path.resolve(currentDir, "../../artifacts/job-link-audits");
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CLASSIFICATION = "ambiguous";
const DEFAULT_REASON_CODE = "anti_bot_or_access_wall";

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const findArgValue = (name) => {
  const prefix = `${name}=`;
  const direct = process.argv.find((value) => value.startsWith(prefix));
  return direct ? direct.slice(prefix.length) : null;
};

const buildDefaultOutputPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(workspaceArtifactsDir, `retry-apply-link-audit-${timestamp}.json`);
};

const buildRetryIdentity = (row = {}) => (
  String(row?.fingerprint || "").trim()
  || String(row?.jobId || "").trim()
  || String(row?.applyUrl || "").trim()
  || String(row?.sourceUrl || "").trim()
);

const buildRetryTransitionSummary = (results = []) => {
  const transitions = new Map();

  for (const row of results) {
    const transition = `${row?.priorClassification || "unknown"}:${row?.priorReasonCode || "unknown"} -> ${row?.classification || "unknown"}:${row?.reasonCode || "unknown"}`;
    transitions.set(transition, (transitions.get(transition) || 0) + 1);
  }

  return [...transitions.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "en"))
    .map(([transition, count]) => ({ transition, count }));
};

async function main() {
  const reportArg = findArgValue("--report") || process.argv[2];
  if (!reportArg) {
    throw new Error("Pass --report=/absolute/or/relative/path/to/audit-report.json");
  }

  const retryNow = new Date();
  const concurrency = toInt(findArgValue("--concurrency"), DEFAULT_CONCURRENCY);
  const timeoutMs = toInt(findArgValue("--timeout-ms"), DEFAULT_TIMEOUT_MS);
  const limit = toInt(findArgValue("--limit"), 0);
  const classification = findArgValue("--classification") || DEFAULT_CLASSIFICATION;
  const reasonCode = findArgValue("--reason-code") || DEFAULT_REASON_CODE;
  const outputPath = path.resolve(findArgValue("--output") || buildDefaultOutputPath());
  const reportPath = path.resolve(reportArg);

  const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
  const candidates = getRetryableJobCandidatesFromReport(report, {
    classification,
    reasonCode,
  });
  const jobs = limit > 0 ? candidates.slice(0, limit) : candidates;
  const previousByIdentity = new Map(
    candidates.map((candidate) => [buildRetryIdentity(candidate), candidate]),
  );

  const retryReport = await auditJobLinks({
    jobs,
    summaryTotalJobs: jobs.length,
    baselineLabel: "selected retry candidates",
    snapshotLabel: "materialized retry batch",
    fetchImpl: fetch,
    allowCountMismatch: false,
    concurrency,
    timeoutMs,
    now: retryNow,
  });

  const enrichedResults = retryReport.results.map((row) => {
    const previous = previousByIdentity.get(buildRetryIdentity(row)) || {};
    return {
      ...row,
      priorClassification: previous.priorClassification ?? null,
      priorReasonCode: previous.priorReasonCode ?? null,
    };
  });

  const output = {
    ...retryReport,
    results: enrichedResults,
    options: {
      source: "audit-report-retry",
      classification,
      reasonCode,
      concurrency,
      timeoutMs,
      limit: limit || null,
    },
    retryOf: {
      reportPath,
      selectedCandidates: candidates.length,
      retriedCandidates: jobs.length,
    },
    retryTransitions: buildRetryTransitionSummary(enrichedResults),
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    outputPath,
    summary: output.summary,
    retryOf: output.retryOf,
    retryTransitions: output.retryTransitions.slice(0, 10),
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error("Retry apply-link audit failed:", error);
  process.exitCode = 1;
}
