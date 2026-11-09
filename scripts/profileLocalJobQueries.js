import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Job from "../src/models/Job.js";
import { runIndexManagement } from "./indexes.js";
import { seedJobProfileFixtures } from "./lib/jobProfileFixtures.js";
import { runJobQueryProfile } from "./profileJobQueries.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(currentDir, "..");

const getFlag = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const getIntegerFlag = (name, fallback) => {
  const value = Number.parseInt(String(getFlag(name, "")), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const readProfilerReport = (artifacts) => JSON.parse(readFileSync(artifacts.jsonPath, "utf8"));

const buildCaseLookup = (report) => new Map(report.cases.map((item) => [item.name, item]));

const formatNumeric = (value) => (value == null ? "n/a" : String(value));

const buildSummaryMarkdown = ({ seedInfo, beforeReport, afterReport, planBefore, planAfter }) => {
  const importantCases = [
    "jobs.latest.unfiltered",
    "jobs.text",
    "jobs.company_city",
    "jobs.all_filters",
    "jobs.legacy.offset.page100",
    "meta.company.scoped",
  ];
  const beforeCases = buildCaseLookup(beforeReport);
  const afterCases = buildCaseLookup(afterReport);
  const lines = [
    "# Local Mongo Query Profile",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Fixture",
    "",
    `- Total seeded jobs: ${seedInfo.totalJobs}`,
    `- Canonical match job: ${seedInfo.canonicalMatch.title} at ${seedInfo.canonicalMatch.company} in ${seedInfo.canonicalMatch.city}`,
    `- Canonical match postedAt: ${seedInfo.canonicalMatch.postedAt}`,
    "",
    "## Index Planning",
    "",
    `- Plan before apply has differences: ${planBefore.hasDifferences}`,
    `- Plan after apply has differences: ${planAfter.hasDifferences}`,
    "",
    "## Key Case Comparison",
    "",
    "| Case | Docs Before | Docs After | Keys Before | Keys After | p95 Before | p95 After | Indexes After |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const caseName of importantCases) {
    const beforeCase = beforeCases.get(caseName);
    const afterCase = afterCases.get(caseName);
    lines.push(
      `| ${caseName} | ${formatNumeric(beforeCase?.explain?.totalDocsExamined)} | ${formatNumeric(afterCase?.explain?.totalDocsExamined)} | ${formatNumeric(beforeCase?.explain?.totalKeysExamined)} | ${formatNumeric(afterCase?.explain?.totalKeysExamined)} | ${formatNumeric(beforeCase?.timing?.timingsMs?.p95)} | ${formatNumeric(afterCase?.timing?.timingsMs?.p95)} | ${(afterCase?.explain?.indexNames ?? []).join(", ") || "n/a"} |`,
    );
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This harness uses `mongodb-memory-server`, so the database is local and disposable.");
  lines.push("- The dataset is synthetic but shaped to exercise the real query builder, pagination, metadata, and text-search paths.");
  lines.push("- Use the same workflow against a confirmed non-production dataset when higher-fidelity benchmark evidence becomes available.");
  lines.push("");

  return `${lines.join("\n")}\n`;
};

const main = async () => {
  const repeat = getIntegerFlag("repeat", 1);
  const totalJobs = getIntegerFlag("total-jobs", 1800);
  const outputDir = path.resolve(
    backendDir,
    getFlag("output-dir", "../artifacts/local-job-query-profile"),
  );
  const mongoDownloadDir = path.resolve(
    process.env.MONGOMS_DOWNLOAD_DIR || path.join(backendDir, ".cache", "mongodb-binaries"),
  );
  const beforeOutputDir = path.join(outputDir, "before-indexes");
  const afterOutputDir = path.join(outputDir, "after-indexes");

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(mongoDownloadDir, { recursive: true });
  mkdirSync(beforeOutputDir, { recursive: true });
  mkdirSync(afterOutputDir, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = mongoDownloadDir;

  const mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: "jobverify_profile",
      ip: "127.0.0.1",
      launchTimeout: 60_000,
      storageEngine: "wiredTiger",
    },
  });

  const mongoUri = mongoServer.getUri();

  try {
    process.env.MONGO_URI = mongoUri;
    process.env.NODE_ENV = "test";
    process.env.JOBVERIFY_ACKNOWLEDGE_INDEX_MUTATIONS = "true";
    await mongoose.connect(mongoUri);
    await Job.deleteMany({});
    const seedInfo = await seedJobProfileFixtures(Job, { totalJobs });
    const planBefore = await runIndexManagement({
      mode: "plan",
      shouldConnect: false,
      shouldDisconnect: false,
      log: () => {},
      errorLog: () => {},
    });
    writeFileSync(
      path.join(outputDir, "indexes-plan-before.json"),
      `${JSON.stringify(planBefore, null, 2)}\n`,
    );
    const beforePayload = await runJobQueryProfile({
      repeat,
      outputDir: beforeOutputDir,
      shouldConnect: false,
      shouldDisconnect: false,
    });
    const beforeReport = readProfilerReport(beforePayload.artifacts);

    const applyResult = await runIndexManagement({
      mode: "apply",
      dryRun: false,
      shouldConnect: false,
      shouldDisconnect: false,
      log: () => {},
      errorLog: () => {},
    });
    writeFileSync(
      path.join(outputDir, "indexes-apply.json"),
      `${JSON.stringify(applyResult, null, 2)}\n`,
    );
    const planAfter = await runIndexManagement({
      mode: "plan",
      shouldConnect: false,
      shouldDisconnect: false,
      log: () => {},
      errorLog: () => {},
    });
    writeFileSync(
      path.join(outputDir, "indexes-plan-after.json"),
      `${JSON.stringify(planAfter, null, 2)}\n`,
    );
    const afterPayload = await runJobQueryProfile({
      repeat,
      outputDir: afterOutputDir,
      shouldConnect: false,
      shouldDisconnect: false,
    });
    const afterReport = readProfilerReport(afterPayload.artifacts);

    const summaryPath = path.join(outputDir, "local-job-query-profile-summary.md");
    writeFileSync(
      summaryPath,
      buildSummaryMarkdown({
        seedInfo,
        beforeReport,
        afterReport,
        planBefore,
        planAfter,
      }),
    );

    console.log(JSON.stringify({
      outputDir,
      summaryPath,
      beforeArtifacts: beforePayload.artifacts,
      afterArtifacts: afterPayload.artifacts,
      indexArtifacts: {
        planBefore: path.join(outputDir, "indexes-plan-before.json"),
        apply: path.join(outputDir, "indexes-apply.json"),
        planAfter: path.join(outputDir, "indexes-plan-after.json"),
      },
      seedInfo,
    }, null, 2));
  } finally {
    await mongoose.disconnect().catch(() => {});
    await mongoServer.stop();
  }
};

main().catch((error) => {
  console.error("Local job query profiling failed:", error);
  process.exitCode = 1;
});
