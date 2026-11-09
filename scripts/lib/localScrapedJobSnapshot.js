import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { filterIndiaJobs } from "../../scraper-support/utils/indiaLocationFilter.js";
import { normalizeScrapedJob } from "../../scraper-support/utils/normalizeScrapedJob.js";
import { generateFingerprint } from "../../scraper-support/utils/saveToDB.js";
import {
  buildJobPostedAtCutoff,
  normalizeLifecycleDate,
  resolveJobPostedAt,
  startOfUtcDay,
} from "../../src/utils/jobLifecycle.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultScraperDir = path.resolve(currentDir, "../../scraper");

const isSeniorRole = (title = "") => (
  /\b(senior|sr\.?|lead|principal|staff|manager|director|head\s+of|vp|vice\s+president|architect|distinguished|fellow|executive)\b/i
    .test(title)
);

const normalizeHttpUrl = (value) => {
  try {
    const parsed = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const buildLocalScrapedJobAuditSnapshot = async ({
  scraperDir = defaultScraperDir,
  now = new Date(),
} = {}) => {
  const resolvedNow = normalizeLifecycleDate(now) || new Date();
  const postedAtCutoff = buildJobPostedAtCutoff(resolvedNow);
  const today = startOfUtcDay(resolvedNow);
  const counts = {
    rawJobs: 0,
    indiaJobs: 0,
    eligibleJobs: 0,
    uniqueEligibleJobs: 0,
    duplicatesCollapsed: 0,
    filteredNonIndia: 0,
    filteredSenior: 0,
    filteredInvalidUrl: 0,
    filteredOld: 0,
    filteredClosed: 0,
  };
  const jobsByFingerprint = new Map();

  const entries = (await fs.readdir(scraperDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name, "en"));

  for (const entry of entries) {
    const jobsPath = path.join(scraperDir, entry.name, "jobs.json");
    let raw;

    try {
      raw = await fs.readFile(jobsPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const parsedJobs = JSON.parse(raw);
    if (!Array.isArray(parsedJobs)) continue;

    counts.rawJobs += parsedJobs.length;

    const indiaJobs = filterIndiaJobs(parsedJobs);
    counts.indiaJobs += indiaJobs.length;
    counts.filteredNonIndia += parsedJobs.length - indiaJobs.length;

    for (const job of indiaJobs) {
      if (isSeniorRole(job?.title)) {
        counts.filteredSenior += 1;
        continue;
      }

      const normalizedJob = normalizeScrapedJob(job, {
        source: job?.source || entry.name,
      });
      const sourceUrl = normalizeHttpUrl(normalizedJob.sourceUrl);
      const applyUrl = normalizeHttpUrl(normalizedJob.applyUrl) || sourceUrl;

      if (!applyUrl) {
        counts.filteredInvalidUrl += 1;
        continue;
      }

      const postedAt = resolveJobPostedAt(normalizedJob);
      if (postedAt && startOfUtcDay(postedAt) < postedAtCutoff) {
        counts.filteredOld += 1;
        continue;
      }

      const closingDate = normalizeLifecycleDate(normalizedJob.closingDate);
      if (closingDate && startOfUtcDay(closingDate) < today) {
        counts.filteredClosed += 1;
        continue;
      }

      counts.eligibleJobs += 1;

      const fingerprint = generateFingerprint(normalizedJob);
      if (jobsByFingerprint.has(fingerprint)) {
        counts.duplicatesCollapsed += 1;
      }

      jobsByFingerprint.set(fingerprint, {
        fingerprint,
        title: normalizedJob.title ?? null,
        company: normalizedJob.company ?? null,
        source: normalizedJob.source || entry.name,
        applyUrl,
        sourceUrl,
        atsPlatform: normalizedJob.atsPlatform ?? null,
        jobId: normalizedJob.jobId ?? null,
        requisitionId: normalizedJob.requisitionId ?? null,
        postedAt: postedAt?.toISOString?.() ?? null,
        closingDate: closingDate?.toISOString?.() ?? null,
      });
    }
  }

  counts.uniqueEligibleJobs = jobsByFingerprint.size;

  return {
    generatedAt: resolvedNow.toISOString(),
    postedAtCutoff: postedAtCutoff.toISOString(),
    counts,
    jobs: [...jobsByFingerprint.values()],
  };
};
