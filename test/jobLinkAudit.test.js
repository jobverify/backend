import assert from "node:assert/strict";
import test from "node:test";

import {
  auditJobLinks,
  buildAuditDatasetConfig,
  buildDatasetStabilityCheck,
  classifyJobLinkProbe,
  getDeadJobCandidatesFromReport,
  getRetryableJobCandidatesFromReport,
  probeJobLink,
  waitForStableDataset,
} from "../scripts/lib/jobLinkAudit.js";

test("buildDatasetStabilityCheck catches a rebuilding dataset when summary and live job counts differ", () => {
  const result = buildDatasetStabilityCheck({
    summaryTotalJobs: 7968,
    activeJobCount: 990,
  });

  assert.equal(result.isStable, false);
  assert.equal(result.summaryTotalJobs, 7968);
  assert.equal(result.activeJobCount, 990);
  assert.match(result.reason, /summary/i);
  assert.match(result.reason, /active/i);
});

test("buildDatasetStabilityCheck rejects a settled dataset when it does not match the requested expected count", () => {
  const result = buildDatasetStabilityCheck({
    summaryTotalJobs: 8100,
    activeJobCount: 8100,
    expectedTotalJobs: 7968,
  });

  assert.equal(result.isStable, false);
  assert.equal(result.summaryTotalJobs, 8100);
  assert.equal(result.activeJobCount, 8100);
  assert.equal(result.expectedTotalJobs, 7968);
  assert.match(result.reason, /expected/i);
  assert.match(result.reason, /7968/);
});

test("buildAuditDatasetConfig defaults to the public active-job scope that matches the persisted summary", () => {
  const result = buildAuditDatasetConfig({
    now: new Date("2026-07-29T00:00:00.000Z"),
  });

  assert.equal(result.scope, "public");
  assert.equal(result.label, "public active jobs");
  assert.equal(result.query.status, "active");
  assert.equal(result.query.isPublicIndia, true);
  assert.match(result.baselineLabel, /public-job summary/i);
  assert.match(result.snapshotLabel, /public-job audit snapshot/i);
});

test("buildAuditDatasetConfig can target all active jobs without the public-location filter", () => {
  const result = buildAuditDatasetConfig({
    scope: "all",
  });

  assert.equal(result.scope, "all");
  assert.equal(result.label, "all active jobs");
  assert.deepEqual(result.query, { status: "active" });
  assert.match(result.baselineLabel, /active-job count/i);
  assert.match(result.snapshotLabel, /audit snapshot/i);
});

test("classifyJobLinkProbe marks an HTTP 404 job page as dead", () => {
  const result = classifyJobLinkProbe({
    job: {
      _id: "job-404",
      company: "Example",
      title: "Removed Engineer",
      applyUrl: "https://example.com/jobs/removed",
    },
    resolvedUrl: "https://example.com/jobs/removed",
    response: {
      status: 404,
      url: "https://example.com/jobs/removed",
    },
    responseText: "<html><body>Not Found</body></html>",
  });

  assert.equal(result.classification, "dead");
  assert.equal(result.reasonCode, "http_404");
  assert.equal(result.statusCode, 404);
});

test("classifyJobLinkProbe marks a Workday page with postingAvailable false as dead", () => {
  const result = classifyJobLinkProbe({
    job: {
      _id: "job-workday-gone",
      company: "Example",
      title: "Removed Engineer",
      applyUrl: "https://example.wd5.myworkdayjobs.com/en-US/careers/job/removed-role",
      atsPlatform: "workday",
    },
    resolvedUrl: "https://example.wd5.myworkdayjobs.com/en-US/careers/job/removed-role",
    response: {
      status: 200,
      url: "https://example.wd5.myworkdayjobs.com/en-US/careers/job/removed-role",
    },
    responseText: "<script>window.workday = { postingAvailable: false };</script>",
  });

  assert.equal(result.classification, "dead");
  assert.equal(result.reasonCode, "workday_posting_unavailable");
});

test("classifyJobLinkProbe preserves Workday maintenance pages as temporary issues instead of dead jobs", () => {
  const result = classifyJobLinkProbe({
    job: {
      _id: "job-workday-maintenance",
      company: "Example",
      title: "Temporarily unavailable role",
      applyUrl: "https://example.wd5.myworkdayjobs.com/en-US/careers/job/maintenance-role",
      atsPlatform: "workday",
    },
    resolvedUrl: "https://example.wd5.myworkdayjobs.com/en-US/careers/job/maintenance-role",
    response: {
      status: 200,
      url: "https://community.workday.com/maintenance-page?d=5&s=1&e=1&o=",
    },
    responseText:
      "<html><head><title>Workday is currently unavailable.</title></head><body>maintenance-page</body></html>",
  });

  assert.equal(result.classification, "temporary_issue");
  assert.equal(result.reasonCode, "workday_outage");
});

test("classifyJobLinkProbe treats timeout request errors as temporary issues", () => {
  const timeoutError = new Error("Timed out after 10000ms");
  timeoutError.code = "ETIMEDOUT";

  const result = classifyJobLinkProbe({
    job: {
      _id: "job-timeout",
      company: "Example",
      title: "Slow Engineer",
      applyUrl: "https://example.com/jobs/slow",
    },
    resolvedUrl: "https://example.com/jobs/slow",
    error: timeoutError,
  });

  assert.equal(result.classification, "temporary_issue");
  assert.equal(result.reasonCode, "request_timeout");
});

test("classifyJobLinkProbe treats TLS transport failures as temporary issues", () => {
  const tlsError = new TypeError("fetch failed");
  tlsError.cause = {
    code: "ERR_TLS_CERT_ALTNAME_INVALID",
    message: "Hostname/IP does not match certificate's altnames",
  };

  const result = classifyJobLinkProbe({
    job: {
      _id: "job-tls-issue",
      companyName: "LTIMindtree",
      applyUrl: "https://careers.ltimindtree.com/talentcommunity/apply/870365101/?locale=en_US",
    },
    resolvedUrl: "https://careers.ltimindtree.com/talentcommunity/apply/870365101/?locale=en_US",
    error: tlsError,
  });

  assert.equal(result.classification, "temporary_issue");
  assert.equal(result.reasonCode, "request_transport_error");
});

test("getDeadJobCandidatesFromReport returns only dead audit rows with Mongo job ids", () => {
  const candidates = getDeadJobCandidatesFromReport({
    results: [
      {
        jobId: "6870fd13144a7f0f2b6a77f1",
        classification: "dead",
        company: "Example",
        title: "Removed Engineer",
      },
      {
        jobId: "6870fd13144a7f0f2b6a77f2",
        classification: "temporary_issue",
        company: "Example",
        title: "Retry Later Engineer",
      },
      {
        classification: "dead",
        company: "Example",
        title: "Missing Id Engineer",
      },
      {
        fingerprint: "a".repeat(64),
        classification: "dead",
        company: "Example",
        title: "Fingerprint Only Engineer",
      },
    ],
  });

  assert.deepEqual(candidates, [
    {
      jobId: "6870fd13144a7f0f2b6a77f1",
      fingerprint: null,
      classification: "dead",
      company: "Example",
      title: "Removed Engineer",
    },
    {
      jobId: null,
      fingerprint: "a".repeat(64),
      classification: "dead",
      company: "Example",
      title: "Fingerprint Only Engineer",
    },
  ]);
});

test("getRetryableJobCandidatesFromReport returns only ambiguous anti-bot rows with retryable job fields", () => {
  const candidates = getRetryableJobCandidatesFromReport({
    results: [
      {
        jobId: "6870fd13144a7f0f2b6a77f1",
        fingerprint: "b".repeat(64),
        classification: "ambiguous",
        reasonCode: "anti_bot_or_access_wall",
        company: "Example",
        title: "Blocked Engineer",
        source: "example-source",
        applyUrl: "https://example.com/jobs/blocked",
        sourceUrl: "https://example.com/jobs/source",
        atsPlatform: "workday",
      },
      {
        jobId: "6870fd13144a7f0f2b6a77f2",
        classification: "ambiguous",
        reasonCode: "different_reason",
        company: "Example",
        title: "Wrong Ambiguous Engineer",
        applyUrl: "https://example.com/jobs/wrong-ambiguous",
      },
      {
        jobId: "6870fd13144a7f0f2b6a77f3",
        classification: "error",
        reasonCode: "request_error",
        company: "Example",
        title: "Retryable Error Engineer",
        applyUrl: "https://example.com/jobs/request-error",
      },
    ],
  });

  assert.deepEqual(candidates, [
    {
      _id: "6870fd13144a7f0f2b6a77f1",
      fingerprint: "b".repeat(64),
      company: "Example",
      title: "Blocked Engineer",
      source: "example-source",
      applyUrl: "https://example.com/jobs/blocked",
      sourceUrl: "https://example.com/jobs/source",
      atsPlatform: "workday",
      priorClassification: "ambiguous",
      priorReasonCode: "anti_bot_or_access_wall",
    },
  ]);
});

test("auditJobLinks refuses to audit when the persisted summary count does not match the snapshot size", async () => {
  await assert.rejects(
    auditJobLinks({
      jobs: [
        {
          _id: "6870fd13144a7f0f2b6a77f1",
          company: "Example",
          title: "Engineer",
          applyUrl: "https://example.com/jobs/engineer",
        },
      ],
      summaryTotalJobs: 7968,
      fetchImpl: async () => ({
        status: 200,
        url: "https://example.com/jobs/engineer",
        text: async () => "<html><body>Engineer</body></html>",
      }),
    }),
    /7968/,
  );
});

test("auditJobLinks builds report rows and summary counts from a settled snapshot", async () => {
  const report = await auditJobLinks({
    jobs: [
      {
        _id: "6870fd13144a7f0f2b6a77f1",
        company: "Example",
        title: "Removed Engineer",
        applyUrl: "https://example.com/jobs/removed",
      },
      {
        _id: "6870fd13144a7f0f2b6a77f2",
        company: "Example",
        title: "Live Engineer",
        applyUrl: "https://example.com/jobs/live",
      },
    ],
    summaryTotalJobs: 2,
    fetchImpl: async (url) => {
      if (url.endsWith("/removed")) {
        return {
          status: 404,
          url,
          text: async () => "<html><body>Not Found</body></html>",
        };
      }

      return {
        status: 200,
        url,
        text: async () => "<html><body>Live Engineer</body></html>",
      };
    },
    now: new Date("2026-07-28T18:00:00.000Z"),
  });

  assert.equal(report.summary.totalJobs, 2);
  assert.equal(report.summary.dead, 1);
  assert.equal(report.summary.alive, 1);
  assert.equal(report.results.length, 2);
  assert.deepEqual(
    report.results.map((row) => ({
      jobId: row.jobId,
      classification: row.classification,
      reasonCode: row.reasonCode,
    })),
    [
      {
        jobId: "6870fd13144a7f0f2b6a77f1",
        classification: "dead",
        reasonCode: "http_404",
      },
      {
        jobId: "6870fd13144a7f0f2b6a77f2",
        classification: "alive",
        reasonCode: "reachable",
      },
    ],
  );
});

test("probeJobLink retries a timed out fetch and succeeds on the next attempt", async () => {
  const attempts = [];

  const result = await probeJobLink({
    url: "https://example.com/jobs/slow-role",
    timeoutMs: 10000,
    fetchImpl: async () => {
      attempts.push("fetch");
      if (attempts.length === 1) {
        throw new Error("Timed out after 10000ms");
      }

      return {
        status: 200,
        url: "https://example.com/jobs/slow-role",
        text: async () => "<html><body>Slow role loaded</body></html>",
      };
    },
    sleepImpl: async () => {},
  });

  assert.equal(attempts.length, 2);
  assert.equal(result.response.status, 200);
  assert.match(result.responseText, /Slow role loaded/);
});

test("probeJobLink falls back to HTTPS transport for certificate failures", async () => {
  let fetchCalls = 0;
  let fallbackCalls = 0;

  const certificateError = new TypeError("fetch failed");
  certificateError.cause = {
    code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    message: "unable to verify the first certificate",
  };

  const result = await probeJobLink({
    url: "https://example.com/jobs/cert-problem",
    timeoutMs: 10000,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw certificateError;
    },
    fallbackRequestImpl: async () => {
      fallbackCalls += 1;
      return {
        response: {
          status: 200,
          url: "https://example.com/jobs/cert-problem",
        },
        responseText: "<html><body>Certificate fallback worked</body></html>",
      };
    },
    sleepImpl: async () => {},
  });

  assert.equal(fetchCalls, 1);
  assert.equal(fallbackCalls, 1);
  assert.equal(result.response.status, 200);
  assert.match(result.responseText, /Certificate fallback worked/);
});

test("probeJobLink falls back to HTTPS transport for certificate hostname mismatch failures", async () => {
  let fallbackCalls = 0;

  const certificateError = new TypeError("fetch failed");
  certificateError.cause = {
    code: "ERR_TLS_CERT_ALTNAME_INVALID",
    message: "Hostname/IP does not match certificate's altnames",
  };

  const result = await probeJobLink({
    url: "https://example.com/jobs/cert-host-mismatch",
    timeoutMs: 10000,
    fetchImpl: async () => {
      throw certificateError;
    },
    fallbackRequestImpl: async () => {
      fallbackCalls += 1;
      return {
        response: {
          status: 200,
          url: "https://example.com/jobs/cert-host-mismatch",
        },
        responseText: "<html><body>Altname fallback worked</body></html>",
      };
    },
    sleepImpl: async () => {},
  });

  assert.equal(fallbackCalls, 1);
  assert.equal(result.response.status, 200);
  assert.match(result.responseText, /Altname fallback worked/);
});

test("waitForStableDataset keeps polling until the dataset is stable and matches the expected total", async () => {
  const snapshots = [
    { summaryTotalJobs: 7968, activeJobCount: 2300 },
    { summaryTotalJobs: 8100, activeJobCount: 8100 },
    { summaryTotalJobs: 7968, activeJobCount: 7968 },
    { summaryTotalJobs: 7968, activeJobCount: 7968 },
  ];
  const pollReasons = [];
  let sleepCalls = 0;

  const result = await waitForStableDataset({
    getSnapshot: async () => snapshots.shift(),
    expectedTotalJobs: 7968,
    maxAttempts: 5,
    minStablePolls: 2,
    pollIntervalMs: 1,
    sleep: async () => {
      sleepCalls += 1;
    },
    onPoll: (status) => {
      pollReasons.push(status.reason);
    },
  });

  assert.equal(result.summaryTotalJobs, 7968);
  assert.equal(result.activeJobCount, 7968);
  assert.equal(result.isStable, true);
  assert.equal(result.stableStreak, 2);
  assert.equal(result.minStablePolls, 2);
  assert.equal(sleepCalls, 3);
  assert.equal(pollReasons.length, 4);
});

test("waitForStableDataset throws after exhausting attempts without a stable expected-count snapshot", async () => {
  await assert.rejects(
    waitForStableDataset({
      getSnapshot: async () => ({
        summaryTotalJobs: 7968,
        activeJobCount: 2400,
      }),
      expectedTotalJobs: 7968,
      maxAttempts: 2,
      pollIntervalMs: 1,
      sleep: async () => {},
    }),
    /stable dataset/i,
  );
});
