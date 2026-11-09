import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryAbuseStore,
  createPublicJobAbuseGuard,
  getPublicJobAbuseConfig,
} from "../src/middleware/publicJobAbuseGuard.js";

const createRequest = ({
  method = "GET",
  url = "/api/jobs",
  ip = "203.0.113.10",
  params = {},
  query = {},
  body = {},
  headers = {},
} = {}) => ({
  method,
  originalUrl: url,
  url,
  path: String(url).split("?")[0],
  ip,
  params,
  query,
  body,
  headers,
});

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  set(name, value) {
    this.headers[name] = String(value);
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = String(value);
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const runGuard = (guard, requestOptions) => {
  const req = createRequest(requestOptions);
  const res = createResponse();
  let nextCalled = false;

  guard(req, res, () => {
    nextCalled = true;
  });

  return { req, res, nextCalled };
};

test('search URL variants and HEAD requests share pagination abuse limits', () => {
  for (const url of ['/api/jobs/search/', '/API/JOBS/SEARCH', '/search/']) {
    for (const method of ['GET', 'HEAD']) {
      const guard = createPublicJobAbuseGuard({ pageWalkLimit: 1 });
      assert.equal(runGuard(guard, { url, method, query: { page: '1' } }).nextCalled, true);
      assert.equal(runGuard(guard, { url, method, query: { page: '2' } }).res.statusCode, 429, `${method} ${url}`);
    }
  }
});

test('an active block applies even when the request has no pagination signal', () => {
  const guard = createPublicJobAbuseGuard({ pageWalkLimit: 1, violationLimit: 1 });
  runGuard(guard, { query: { page: '1' } });
  assert.equal(runGuard(guard, { query: { page: '2' } }).res.statusCode, 403);
  for (const url of ['/api/jobs/search/', '/api/jobs/meta', '/search', '/stats']) {
    assert.equal(runGuard(guard, { url }).res.statusCode, 403, url);
  }
});

test("getPublicJobAbuseConfig reads the explicit env knobs and falls back to plan defaults", () => {
  const config = getPublicJobAbuseConfig({
    PUBLIC_JOB_ABUSE_PAGE_WALK_WINDOW_MS: "61000",
    PUBLIC_JOB_ABUSE_PAGE_WALK_LIMIT: "31",
    PUBLIC_JOB_ABUSE_DETAIL_WINDOW_MS: "62000",
    PUBLIC_JOB_ABUSE_DETAIL_LIMIT: "91",
    PUBLIC_JOB_ABUSE_VIOLATION_WINDOW_MS: "930000",
    PUBLIC_JOB_ABUSE_VIOLATION_LIMIT: "6",
    PUBLIC_JOB_ABUSE_BLOCK_MS: "940000",
    PUBLIC_JOB_ABUSE_MAX_RECORDS: "4321",
  });

  assert.deepEqual(config, {
    pageWalkWindowMs: 61_000,
    pageWalkLimit: 31,
    detailWindowMs: 62_000,
    detailLimit: 91,
    violationWindowMs: 930_000,
    violationLimit: 6,
    blockMs: 940_000,
    maxRecords: 4_321,
  });

  assert.deepEqual(getPublicJobAbuseConfig({}), {
    pageWalkWindowMs: 60_000,
    pageWalkLimit: 30,
    detailWindowMs: 60_000,
    detailLimit: 90,
    violationWindowMs: 900_000,
    violationLimit: 5,
    blockMs: 900_000,
    maxRecords: 5_000,
  });
});

test("allows normal anonymous browse and detail traffic below the configured thresholds", () => {
  let nowValue = 1_000;
  const guard = createPublicJobAbuseGuard({
    now: () => nowValue,
    pageWalkWindowMs: 60_000,
    pageWalkLimit: 2,
    detailWindowMs: 60_000,
    detailLimit: 2,
    violationWindowMs: 900_000,
    violationLimit: 2,
    blockMs: 900_000,
    maxRecords: 5,
  });

  const firstPage = runGuard(guard, {
    url: "/api/jobs?page=1",
    query: { page: "1" },
  });
  nowValue += 100;
  const firstDetail = runGuard(guard, {
    url: "/api/jobs/507f191e810c19729de860ea",
    params: { id: "507f191e810c19729de860ea" },
  });

  assert.equal(firstPage.nextCalled, true);
  assert.equal(firstPage.res.statusCode, 200);
  assert.equal(firstDetail.nextCalled, true);
  assert.equal(firstDetail.res.statusCode, 200);
});

test("throttles rapid distinct job pages with Retry-After and Cache-Control", () => {
  let nowValue = 5_000;
  const guard = createPublicJobAbuseGuard({
    now: () => nowValue,
    pageWalkWindowMs: 60_000,
    pageWalkLimit: 2,
    detailWindowMs: 60_000,
    detailLimit: 5,
    violationWindowMs: 900_000,
    violationLimit: 3,
    blockMs: 900_000,
    maxRecords: 5,
  });

  runGuard(guard, { url: "/api/jobs?page=1", query: { page: "1" } });
  nowValue += 100;
  runGuard(guard, { url: "/api/jobs?page=2", query: { page: "2" } });
  nowValue += 100;
  const throttled = runGuard(guard, {
    url: "/api/jobs?page=3",
    query: { page: "3" },
  });

  assert.equal(throttled.nextCalled, false);
  assert.equal(throttled.res.statusCode, 429);
  assert.equal(throttled.res.headers["Retry-After"], "60");
  assert.equal(throttled.res.headers["Cache-Control"], "no-store");
  assert.deepEqual(throttled.res.body, {
    code: 429,
    error: "rate_limited",
    success: false,
    message: "Too many requests. Please try again later.",
  });
});

test("temporarily blocks a client after repeated throttles", () => {
  let nowValue = 20_000;
  const guard = createPublicJobAbuseGuard({
    now: () => nowValue,
    pageWalkWindowMs: 60_000,
    pageWalkLimit: 1,
    detailWindowMs: 60_000,
    detailLimit: 10,
    violationWindowMs: 900_000,
    violationLimit: 2,
    blockMs: 900_000,
    maxRecords: 5,
  });

  runGuard(guard, { url: "/api/jobs?page=1", query: { page: "1" } });
  nowValue += 100;
  runGuard(guard, { url: "/api/jobs?page=2", query: { page: "2" } });
  nowValue += 100;
  const blocked = runGuard(guard, {
    url: "/api/jobs?page=3",
    query: { page: "3" },
  });

  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.res.statusCode, 403);
  assert.equal(blocked.res.headers["Retry-After"], "900");
  assert.equal(blocked.res.headers["Cache-Control"], "no-store");
  assert.deepEqual(blocked.res.body, {
    code: 403,
    error: "access_denied",
    success: false,
    message: "Access temporarily restricted. Please try again later.",
  });
});

test("expires inactive client state after the longest tracking window", () => {
  let nowValue = 100_000;
  const guard = createPublicJobAbuseGuard({
    now: () => nowValue,
    pageWalkWindowMs: 60_000,
    pageWalkLimit: 1,
    detailWindowMs: 60_000,
    detailLimit: 10,
    violationWindowMs: 900_000,
    violationLimit: 2,
    blockMs: 900_000,
    maxRecords: 5,
  });

  runGuard(guard, { url: "/api/jobs?page=1", query: { page: "1" } });
  nowValue += 100;
  const throttled = runGuard(guard, {
    url: "/api/jobs?page=2",
    query: { page: "2" },
  });

  nowValue += 901_000;
  const recovered = runGuard(guard, {
    url: "/api/jobs?page=1",
    query: { page: "1" },
  });

  assert.equal(throttled.res.statusCode, 429);
  assert.equal(recovered.nextCalled, true);
  assert.equal(recovered.res.statusCode, 200);
});

test("tracks abuse state separately per client IP", () => {
  const guard = createPublicJobAbuseGuard({
    now: () => 0,
    pageWalkWindowMs: 60_000,
    pageWalkLimit: 1,
    detailWindowMs: 60_000,
    detailLimit: 10,
    violationWindowMs: 900_000,
    violationLimit: 3,
    blockMs: 900_000,
    maxRecords: 5,
  });

  runGuard(guard, {
    ip: "203.0.113.10",
    url: "/api/jobs?page=1",
    query: { page: "1" },
  });
  const throttled = runGuard(guard, {
    ip: "203.0.113.10",
    url: "/api/jobs?page=2",
    query: { page: "2" },
  });
  const otherClient = runGuard(guard, {
    ip: "198.51.100.22",
    url: "/api/jobs?page=2",
    query: { page: "2" },
  });

  assert.equal(throttled.res.statusCode, 429);
  assert.equal(otherClient.nextCalled, true);
  assert.equal(otherClient.res.statusCode, 200);
});

test("createInMemoryAbuseStore evicts the oldest records after maxRecords is reached", () => {
  let nowValue = 10_000;
  const store = createInMemoryAbuseStore({
    now: () => nowValue,
    maxRecords: 1,
  });

  store.set("198.51.100.10", {
    pageSignals: [],
    detailSignals: [],
    violations: [{ value: "v1", expiresAt: nowValue + 1_000 }],
    blockedUntil: 0,
    lastSeenAt: nowValue,
  });
  nowValue += 1;
  store.set("198.51.100.11", {
    pageSignals: [],
    detailSignals: [],
    violations: [{ value: "v2", expiresAt: nowValue + 1_000 }],
    blockedUntil: 0,
    lastSeenAt: nowValue,
  });

  assert.equal(store.entries().some(([key]) => key === "198.51.100.10"), false);
  assert.equal(store.entries().some(([key]) => key === "198.51.100.11"), true);
});

test("createInMemoryAbuseStore sweepExpired removes records older than the supplied cutoff", () => {
  let nowValue = 50_000;
  const store = createInMemoryAbuseStore({
    now: () => nowValue,
    maxRecords: 5,
  });

  store.set("old-client", {
    pageSignals: [],
    detailSignals: [],
    violations: [{ value: "old", expiresAt: nowValue + 1_000 }],
    blockedUntil: 0,
    lastSeenAt: nowValue,
  });
  nowValue += 10;
  store.set("new-client", {
    pageSignals: [],
    detailSignals: [],
    violations: [{ value: "new", expiresAt: nowValue + 1_000 }],
    blockedUntil: 0,
    lastSeenAt: nowValue,
  });

  store.sweepExpired(nowValue);

  assert.equal(store.get("old-client"), null);
  assert.equal(store.get("new-client")?.violations?.[0]?.value, "new");
});
