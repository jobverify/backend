import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";

import { hasWorkdayOutageSignal } from "../../scraper-support/myworkday/engine.js";
import { applyPublicJobLocationScope } from "../../src/utils/publicJobLocationScope.js";

const HTTP_DEAD_STATUS_CODES = new Set([404, 410]);
const HTTP_TEMPORARY_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 521, 522, 523, 524]);
const WORKDAY_POSTING_UNAVAILABLE_PATTERN = /\bpostingAvailable\s*[:=]\s*false\b/i;
const GENERIC_DEAD_TEXT_PATTERNS = [
  /\bjob not found\b/i,
  /\bpage not found\b/i,
  /\bthis job is no longer available\b/i,
  /\bthis position is no longer available\b/i,
  /\bthe job you are looking for no longer exists\b/i,
  /\bposition has been filled\b/i,
  /\bopening is no longer available\b/i,
  /\brole you are looking for cannot be found\b/i,
  /\bjob does not exist\b/i,
];
const ANTI_BOT_OR_ACCESS_PATTERNS = [
  /\baccess denied\b/i,
  /\bare you human\b/i,
  /\bverify you are human\b/i,
  /\bcloudflare\b/i,
  /\bplease enable javascript\b/i,
  /\bsorry, you have been blocked\b/i,
  /\brequest unsuccessful\. incident id\b/i,
];
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const DEFAULT_BASELINE_LABEL = "persisted summary";
const DEFAULT_SNAPSHOT_LABEL = "live active jobs snapshot";
const DEFAULT_REQUEST_ATTEMPTS = 2;
const DEFAULT_RETRY_TIMEOUT_FLOOR_MS = 30000;
const SYSTEM_CA_CERTIFICATES = typeof tls.getCACertificates === "function"
  ? tls.getCACertificates("system")
  : [];
const TLS_FALLBACK_ERROR_CODES = new Set([
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);
const toOptionalFiniteNumber = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNormalizedText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const toSnippet = (value = "", maxLength = 240) => {
  const normalized = toNormalizedText(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
};

const toHttpUrl = (value) => {
  if (!value) return null;

  try {
    const parsed = new URL(String(value).trim());
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
};

export const resolveAuditTargetUrl = (job = {}) => (
  toHttpUrl(job.applyUrl) || toHttpUrl(job.sourceUrl)
);

export const isWorkdayAuditTarget = (job = {}, url = "") => {
  if (String(job.atsPlatform || "").trim().toLowerCase() === "workday") return true;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "myworkdayjobs.com"
      || hostname.endsWith(".myworkdayjobs.com")
      || hostname === "workdayjobs.com"
      || hostname.endsWith(".workdayjobs.com");
  } catch {
    return false;
  }
};

export const normalizeAuditScope = (value = "public") => (
  String(value || "public").trim().toLowerCase() === "all" ? "all" : "public"
);

export const buildAuditDatasetConfig = ({
  scope = "public",
  now = new Date(),
} = {}) => {
  const resolvedScope = normalizeAuditScope(scope);

  if (resolvedScope === "all") {
    return {
      scope: resolvedScope,
      label: "all active jobs",
      query: { status: "active" },
      baselineLabel: "live active-job count",
      snapshotLabel: "materialized audit snapshot",
    };
  }

  return {
    scope: "public",
    label: "public active jobs",
    query: applyPublicJobLocationScope({ status: "active" }, now),
    baselineLabel: "persisted public-job summary",
    snapshotLabel: "materialized public-job audit snapshot",
  };
};

export const buildDatasetStabilityCheck = ({
  summaryTotalJobs = null,
  activeJobCount = null,
  expectedTotalJobs = null,
  baselineLabel = DEFAULT_BASELINE_LABEL,
  snapshotLabel = DEFAULT_SNAPSHOT_LABEL,
} = {}) => {
  const normalizedSummary = toOptionalFiniteNumber(summaryTotalJobs);
  const normalizedActive = toOptionalFiniteNumber(activeJobCount);
  const normalizedExpected = toOptionalFiniteNumber(expectedTotalJobs);

  if (normalizedSummary == null) {
    return {
      isStable: false,
      summaryTotalJobs: null,
      activeJobCount: normalizedActive,
      expectedTotalJobs: normalizedExpected,
      baselineLabel,
      snapshotLabel,
      reason: `The ${baselineLabel} is missing, so the audit cannot prove the dataset is settled.`,
    };
  }

  if (normalizedActive == null) {
    return {
      isStable: false,
      summaryTotalJobs: normalizedSummary,
      activeJobCount: null,
      expectedTotalJobs: normalizedExpected,
      baselineLabel,
      snapshotLabel,
      reason: `The ${snapshotLabel} could not be computed, so the audit cannot prove the dataset is settled.`,
    };
  }

  if (normalizedSummary !== normalizedActive) {
    return {
      isStable: false,
      summaryTotalJobs: normalizedSummary,
      activeJobCount: normalizedActive,
      expectedTotalJobs: normalizedExpected,
      baselineLabel,
      snapshotLabel,
      reason: `The ${baselineLabel} reports ${normalizedSummary} jobs but the ${snapshotLabel} contains ${normalizedActive}.`,
    };
  }

  if (normalizedExpected != null && normalizedActive !== normalizedExpected) {
    return {
      isStable: false,
      summaryTotalJobs: normalizedSummary,
      activeJobCount: normalizedActive,
      expectedTotalJobs: normalizedExpected,
      baselineLabel,
      snapshotLabel,
      reason: `The dataset is settled at ${normalizedActive} jobs, but the expected audit target is ${normalizedExpected}.`,
    };
  }

  return {
    isStable: true,
    summaryTotalJobs: normalizedSummary,
    activeJobCount: normalizedActive,
    expectedTotalJobs: normalizedExpected,
    baselineLabel,
    snapshotLabel,
    reason: `The ${baselineLabel} matches the ${snapshotLabel} at ${normalizedActive} jobs.`,
  };
};

export const classifyJobLinkProbe = ({
  job = {},
  resolvedUrl = "",
  response = null,
  responseText = "",
  error = null,
} = {}) => {
  const auditedUrl = resolvedUrl || resolveAuditTargetUrl(job);
  const snippet = toSnippet(responseText);

  if (!auditedUrl) {
    return {
      classification: "dead",
      reasonCode: "missing_url",
      reason: "The job has no usable applyUrl or sourceUrl.",
      auditedUrl: null,
      finalUrl: null,
      statusCode: null,
      snippet: "",
    };
  }

  if (error) {
    if (
      isTimeoutError(error) ||
      shouldRetryRequestError(error) ||
      shouldUseHttpsFallback(error)
    ) {
      return {
        classification: "temporary_issue",
        reasonCode: isTimeoutError(error)
          ? "request_timeout"
          : "request_transport_error",
        reason: String(error?.message || error),
        auditedUrl,
        finalUrl: null,
        statusCode: null,
        snippet: "",
      };
    }

    return {
      classification: "error",
      reasonCode: "request_error",
      reason: String(error?.message || error),
      auditedUrl,
      finalUrl: null,
      statusCode: null,
      snippet: "",
    };
  }

  const statusCode = Number.isFinite(Number(response?.status)) ? Number(response.status) : null;
  const finalUrl = toHttpUrl(response?.url) || auditedUrl;
  const isWorkday = isWorkdayAuditTarget(job, auditedUrl) || isWorkdayAuditTarget(job, finalUrl);

  if (HTTP_DEAD_STATUS_CODES.has(statusCode)) {
    return {
      classification: "dead",
      reasonCode: `http_${statusCode}`,
      reason: `The employer page returned HTTP ${statusCode}.`,
      auditedUrl,
      finalUrl,
      statusCode,
      snippet,
    };
  }

  if (isWorkday && WORKDAY_POSTING_UNAVAILABLE_PATTERN.test(responseText)) {
    return {
      classification: "dead",
      reasonCode: "workday_posting_unavailable",
      reason: "The Workday page reports postingAvailable: false.",
      auditedUrl,
      finalUrl,
      statusCode,
      snippet,
    };
  }

  if (
    isWorkday
    && hasWorkdayOutageSignal({
      html: responseText,
      url: finalUrl,
      responseUrls: [auditedUrl],
    })
  ) {
    return {
      classification: "temporary_issue",
      reasonCode: "workday_outage",
      reason: "The Workday portal is showing a maintenance or outage page.",
      auditedUrl,
      finalUrl,
      statusCode,
      snippet,
    };
  }

  if (HTTP_TEMPORARY_STATUS_CODES.has(statusCode)) {
    return {
      classification: "temporary_issue",
      reasonCode: `http_${statusCode}`,
      reason: `The employer page returned transient HTTP ${statusCode}.`,
      auditedUrl,
      finalUrl,
      statusCode,
      snippet,
    };
  }

  if (ANTI_BOT_OR_ACCESS_PATTERNS.some((pattern) => pattern.test(responseText))) {
    return {
      classification: "ambiguous",
      reasonCode: "anti_bot_or_access_wall",
      reason: "The employer page appears to be blocked by an anti-bot or access wall.",
      auditedUrl,
      finalUrl,
      statusCode,
      snippet,
    };
  }

  const genericDeadPattern = GENERIC_DEAD_TEXT_PATTERNS.find((pattern) => pattern.test(responseText));
  if (genericDeadPattern) {
    return {
      classification: "dead",
      reasonCode: "dead_text",
      reason: "The employer page explicitly says the job is unavailable.",
      auditedUrl,
      finalUrl,
      statusCode,
      snippet,
    };
  }

  return {
    classification: "alive",
    reasonCode: "reachable",
    reason: "The employer page responded without a conclusive dead-job signal.",
    auditedUrl,
    finalUrl,
    statusCode,
    snippet,
  };
};

export const getDeadJobCandidatesFromReport = (report = {}) => (
  Array.isArray(report?.results)
    ? report.results
      .filter((row) => {
        if (row?.classification !== "dead") return false;
        const jobId = String(row?.jobId || "");
        const fingerprint = String(row?.fingerprint || "");
        return OBJECT_ID_PATTERN.test(jobId) || FINGERPRINT_PATTERN.test(fingerprint);
      })
      .map((row) => ({
        jobId: OBJECT_ID_PATTERN.test(String(row?.jobId || "")) ? String(row.jobId) : null,
        fingerprint: FINGERPRINT_PATTERN.test(String(row?.fingerprint || ""))
          ? String(row.fingerprint)
          : null,
        classification: row.classification,
        company: row.company ?? null,
        title: row.title ?? null,
      }))
    : []
);

export const getRetryableJobCandidatesFromReport = (
  report = {},
  {
    classification = "ambiguous",
    reasonCode = "anti_bot_or_access_wall",
  } = {},
) => (
  Array.isArray(report?.results)
    ? report.results
      .filter((row) => {
        if (classification && row?.classification !== classification) return false;
        if (reasonCode && row?.reasonCode !== reasonCode) return false;
        return Boolean(resolveAuditTargetUrl(row));
      })
      .map((row) => ({
        _id: row?.jobId ? String(row.jobId) : null,
        fingerprint: FINGERPRINT_PATTERN.test(String(row?.fingerprint || ""))
          ? String(row.fingerprint)
          : null,
        company: row?.company ?? null,
        title: row?.title ?? null,
        source: row?.source ?? null,
        applyUrl: row?.applyUrl ?? null,
        sourceUrl: row?.sourceUrl ?? null,
        atsPlatform: row?.atsPlatform ?? null,
        priorClassification: row?.classification ?? null,
        priorReasonCode: row?.reasonCode ?? null,
      }))
    : []
);

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const limit = Math.max(1, Number.parseInt(concurrency, 10) || 1);
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) return;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, worker));
  return results;
};

const getErrorCode = (error) => {
  let current = error;
  const visited = new Set();

  while (current && !visited.has(current)) {
    visited.add(current);
    if (typeof current?.code === "string" && current.code.trim()) {
      return current.code.trim();
    }
    current = current?.cause;
  }

  return null;
};

const getErrorMessage = (error) => {
  let current = error;
  const visited = new Set();

  while (current && !visited.has(current)) {
    visited.add(current);
    if (typeof current?.message === "string" && current.message.trim()) {
      return current.message.trim();
    }
    current = current?.cause;
  }

  return String(error ?? "");
};

const isTimeoutError = (error) => /timed out/i.test(getErrorMessage(error));

const shouldUseHttpsFallback = (error) => TLS_FALLBACK_ERROR_CODES.has(getErrorCode(error));

const shouldRetryRequestError = (error) => {
  if (!error) return false;
  if (isTimeoutError(error)) return true;

  const code = getErrorCode(error);
  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
  ].includes(code);
};

const defaultSleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildFetchHeaders = () => ({
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
});

const fetchJobLinkTextOnce = async ({
  url,
  fetchImpl = fetch,
  timeoutMs = 10000,
}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "JobverifyApplyLinkAudit/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const responseText = await response.text();
    return { response, responseText };
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestViaHttpsFallback = async (
  url,
  {
    timeoutMs = 10000,
    maxRedirects = 5,
  } = {},
) => {
  const targetUrl = new URL(url);
  const transport = targetUrl.protocol === "http:" ? http : https;

  const response = await new Promise((resolve, reject) => {
    const request = transport.request(targetUrl, {
      method: "GET",
      headers: buildFetchHeaders(),
      ...(targetUrl.protocol === "https:"
        ? {
          ca: SYSTEM_CA_CERTIFICATES.length > 0 ? SYSTEM_CA_CERTIFICATES : undefined,
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
        }
        : {}),
    }, (incoming) => {
      const status = Number(incoming.statusCode || 0);
      const location = typeof incoming.headers.location === "string" ? incoming.headers.location : null;

      if (location && status >= 300 && status < 400 && maxRedirects > 0) {
        incoming.resume();
        resolve(requestViaHttpsFallback(new URL(location, targetUrl).toString(), {
          timeoutMs,
          maxRedirects: maxRedirects - 1,
        }));
        return;
      }

      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      incoming.on("end", () => {
        resolve({
          response: {
            status,
            url: targetUrl.toString(),
          },
          responseText: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });
    request.on("error", reject);
    request.end();
  });

  return response;
};

export const probeJobLink = async ({
  url,
  fetchImpl = fetch,
  fallbackRequestImpl = requestViaHttpsFallback,
  timeoutMs = 10000,
  attempts = DEFAULT_REQUEST_ATTEMPTS,
  retryTimeoutFloorMs = DEFAULT_RETRY_TIMEOUT_FLOOR_MS,
  sleepImpl = defaultSleepImpl,
} = {}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const attemptTimeoutMs = attempt === 1
      ? timeoutMs
      : Math.max(timeoutMs * attempt, retryTimeoutFloorMs);

    try {
      return await fetchJobLinkTextOnce({
        url,
        fetchImpl,
        timeoutMs: attemptTimeoutMs,
      });
    } catch (error) {
      lastError = error;

      if (shouldUseHttpsFallback(error)) {
        return fallbackRequestImpl(url, { timeoutMs: attemptTimeoutMs });
      }

      if (attempt >= attempts || !shouldRetryRequestError(error)) {
        throw error;
      }

      await sleepImpl(0);
    }
  }

  throw lastError ?? new Error(`Unable to probe ${url}`);
};

const buildAuditSummary = (results = []) => {
  const summary = {
    totalJobs: results.length,
    alive: 0,
    dead: 0,
    temporaryIssues: 0,
    ambiguous: 0,
    errors: 0,
  };

  for (const row of results) {
    if (row.classification === "alive") summary.alive += 1;
    else if (row.classification === "dead") summary.dead += 1;
    else if (row.classification === "temporary_issue") summary.temporaryIssues += 1;
    else if (row.classification === "ambiguous") summary.ambiguous += 1;
    else summary.errors += 1;
  }

  return summary;
};

export const auditJobLinks = async ({
  jobs = [],
  summaryTotalJobs = null,
  expectedTotalJobs = null,
  baselineLabel = DEFAULT_BASELINE_LABEL,
  snapshotLabel = DEFAULT_SNAPSHOT_LABEL,
  fetchImpl = fetch,
  allowCountMismatch = false,
  concurrency = 6,
  timeoutMs = 10000,
  now = new Date(),
} = {}) => {
  const stability = buildDatasetStabilityCheck({
    summaryTotalJobs,
    activeJobCount: jobs.length,
    expectedTotalJobs,
    baselineLabel,
    snapshotLabel,
  });

  if (!stability.isStable && !allowCountMismatch) {
    throw new Error(stability.reason);
  }

  const checkedAt = new Date(now).toISOString();
  const results = await mapWithConcurrency(jobs, concurrency, async (job) => {
    const resolvedUrl = resolveAuditTargetUrl(job);
    let outcome;

    if (!resolvedUrl) {
        outcome = classifyJobLinkProbe({ job, resolvedUrl: null });
    } else {
      try {
        const { response, responseText } = await probeJobLink({
          url: resolvedUrl,
          fetchImpl,
          timeoutMs,
        });
        outcome = classifyJobLinkProbe({
          job,
          resolvedUrl,
          response,
          responseText,
        });
      } catch (error) {
        outcome = classifyJobLinkProbe({
          job,
          resolvedUrl,
          error,
        });
      }
    }

    return {
      jobId: String(job?._id || ""),
      fingerprint: typeof job?.fingerprint === "string" ? job.fingerprint : null,
      company: job?.company ?? null,
      title: job?.title ?? null,
      source: job?.source ?? null,
      applyUrl: job?.applyUrl ?? null,
      sourceUrl: job?.sourceUrl ?? null,
      atsPlatform: job?.atsPlatform ?? null,
      checkedAt,
      ...outcome,
    };
  });

  return {
    generatedAt: checkedAt,
    datasetStability: stability,
    summary: buildAuditSummary(results),
    results,
  };
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForStableDataset = async ({
  getSnapshot,
  expectedTotalJobs = null,
  maxAttempts = 120,
  pollIntervalMs = 60000,
  minStablePolls = 1,
  baselineLabel = DEFAULT_BASELINE_LABEL,
  snapshotLabel = DEFAULT_SNAPSHOT_LABEL,
  sleep = defaultSleep,
  onPoll = () => {},
} = {}) => {
  if (typeof getSnapshot !== "function") {
    throw new TypeError("waitForStableDataset requires a getSnapshot function.");
  }

  const resolvedMinStablePolls = Number.parseInt(minStablePolls, 10);
  if (!Number.isFinite(resolvedMinStablePolls) || resolvedMinStablePolls < 1) {
    throw new TypeError("waitForStableDataset requires minStablePolls to be a positive integer.");
  }

  let latestStatus = null;
  let stableStreak = 0;
  let lastStableKey = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const snapshot = await getSnapshot();
    latestStatus = buildDatasetStabilityCheck({
      summaryTotalJobs: snapshot?.summaryTotalJobs ?? null,
      activeJobCount: snapshot?.activeJobCount ?? null,
      expectedTotalJobs,
      baselineLabel,
      snapshotLabel,
    });
    const stableKey = latestStatus.isStable
      ? JSON.stringify([
        latestStatus.summaryTotalJobs,
        latestStatus.activeJobCount,
        latestStatus.expectedTotalJobs,
      ])
      : null;

    if (stableKey && stableKey === lastStableKey) {
      stableStreak += 1;
    } else if (stableKey) {
      stableStreak = 1;
    } else {
      stableStreak = 0;
    }

    lastStableKey = stableKey;
    onPoll({
      attempt,
      maxAttempts,
      minStablePolls: resolvedMinStablePolls,
      stableStreak,
      ...latestStatus,
    });

    if (latestStatus.isStable && stableStreak >= resolvedMinStablePolls) {
      return {
        attempt,
        maxAttempts,
        minStablePolls: resolvedMinStablePolls,
        stableStreak,
        ...latestStatus,
      };
    }

    if (attempt < maxAttempts) {
      await sleep(pollIntervalMs);
    }
  }

  throw new Error(
    `Unable to observe a stable dataset within ${maxAttempts} attempts. Last status: ${latestStatus?.reason || "unknown"}`,
  );
};
