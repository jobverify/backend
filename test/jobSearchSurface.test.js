import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import Job from "../src/models/Job.js";
import JobDatasetSummary from "../src/models/JobDatasetSummary.js";
import { ACCESS_ROLES, PLAN_IDS } from "../src/constants/accessPlans.js";
import { getJobMeta, getJobSearch, getLiveHiringCompanies } from "../src/controllers/jobController.js";
import { buildJobDerivedFields } from "../src/utils/jobDerivedFields.js";
import {
  buildJobSearchKeys,
  normalizeJobSearchKey,
} from "../src/utils/jobSearchKeys.js";
import {
  SearchInputError,
  buildJobSearchRequest,
  decodeJobSearchCursor,
  encodeJobSearchCursor,
} from "../src/services/jobSearchContract.js";

const premiumUser = {
  role: "user",
  accessRole: ACCESS_ROLES.MONTHLY,
  premium: { planId: PLAN_IDS.MONTHLY, status: "active", expiresAt: new Date(Date.now() + 60_000) },
};
const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  set(name, value) {
    if (typeof name === "string") {
      this.headers[name] = value;
    } else if (name && typeof name === "object") {
      Object.assign(this.headers, name);
    }
    return this;
  },
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const controllerSource = fs.readFileSync(
  path.join(import.meta.dirname, "..", "src", "controllers", "jobController.js"),
  "utf8",
);

test("normalizeJobSearchKey creates stable equality keys for categorical filters", () => {
  assert.equal(normalizeJobSearchKey("  Bengaluru   "), "bengaluru");
  assert.equal(normalizeJobSearchKey("S\u00e3o Paulo"), "sao paulo");
  assert.equal(normalizeJobSearchKey(""), null);
});

test("buildJobSearchKeys stores company, city, and all location aliases", () => {
  assert.deepEqual(
    buildJobSearchKeys({
      company: "Acme Labs",
      city: "Bangalore",
      location: "Bengaluru, India",
      locations: ["Bangalore", "Remote", "Bengaluru, India"],
    }),
    {
      companyKey: "acme labs",
      cityKey: "bangalore",
      locationKeys: ["bangalore", "bengaluru, india", "remote"],
    },
  );
});

test("buildJobSearchKeys makes a normalized city from an office address searchable", () => {
  assert.deepEqual(
    buildJobSearchKeys({
      company: "Amara Raja",
      city: "1007 - DXN, TPT, Tirupati, Andhra Pradesh, India",
      location: "1007 - DXN, TPT, Tirupati, Andhra Pradesh, India",
    }).locationKeys,
    ["1007 - dxn, tpt, tirupati, andhra pradesh, india", "tirupati"],
  );
});

test("buildJobSearchKeys keeps Sanand distinct from Anand", () => {
  assert.deepEqual(
    buildJobSearchKeys({
      company: "Example Manufacturing",
      city: "Sanand, Gujarat, India",
      location: "Sanand, Gujarat, India",
    }).locationKeys,
    ["sanand, gujarat, india", "sanand"],
  );
});

test("buildJobDerivedFields materializes the public scope flag and stable sort date", () => {
  const postedAt = new Date("2026-07-20T00:00:00.000Z");

  assert.deepEqual(
    buildJobDerivedFields({
      city: "Noida",
      location: "Noida",
      postedAt,
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      scrapedAt: new Date("2026-07-17T00:00:00.000Z"),
    }),
    {
      sortDate: postedAt,
      isPublicIndia: true,
      publicCityKey: "noida",
    },
  );
});

test("buildJobDerivedFields preserves Sanand as the public city key", () => {
  assert.deepEqual(
    buildJobDerivedFields({
      city: "Sanand, Gujarat, India",
      location: "Sanand, Gujarat, India",
      country: "India",
      postedAt: new Date("2026-07-20T00:00:00.000Z"),
      createdAt: new Date("2026-07-18T00:00:00.000Z"),
      scrapedAt: new Date("2026-07-17T00:00:00.000Z"),
    }),
    {
      sortDate: new Date("2026-07-20T00:00:00.000Z"),
      isPublicIndia: true,
      publicCityKey: "sanand",
    },
  );
});

test("job search request canonicalizes and deduplicates visible multi-select filters", () => {
  const request = buildJobSearchRequest({
    company: [" Example Corp ", "Example Corp", "Other Corp"],
    city: ["Pune", "Bangalore", "Pune"],
    limit: "24",
    sort: "latest",
  });

  assert.deepEqual(request.filters.company, ["Example Corp", "Other Corp"]);
  assert.deepEqual(request.filters.city, ["Bangalore", "Pune"]);
  assert.equal(request.pageSize, 24);
  assert.equal(request.sort, "latest");
  assert.match(request.filterHash, /^[a-f0-9]{64}$/);
});

test("job search request keeps cursor page sizes within the canonical 1000-card limit", () => {
  const request = buildJobSearchRequest({
    company: ["Example Corp"],
    limit: "1000",
    sort: "popularity",
  });

  assert.equal(request.pageSize, 1000);
  assert.equal(request.sort, "popularity");
  assert.throws(
    () => buildJobSearchRequest({ limit: "1200", sort: "latest" }),
    (error) => error instanceof SearchInputError && error.code === "INVALID_PAGE_SIZE",
  );
});

test("job search request rejects unknown fields without accepting MongoDB operators", () => {
  assert.throws(
    () => buildJobSearchRequest({ "$where": "sleep(1000)" }),
    (error) => error instanceof SearchInputError && error.code === "UNKNOWN_FILTER",
  );
});

test("job search request returns a structured hard-limit error", () => {
  assert.throws(
    () => buildJobSearchRequest({ company: Array.from({ length: 51 }, (_, index) => `Company ${index}`) }),
    (error) => (
      error instanceof SearchInputError
      && error.code === "FILTER_VALUE_LIMIT_EXCEEDED"
      && error.maximum === 50
      && error.actual === 51
    ),
  );
});

test("job search cursors are opaque and bound to canonical filters and sort", () => {
  const request = buildJobSearchRequest({ company: ["Example Corp"], sort: "latest" });
  const cursor = encodeJobSearchCursor({
    filterHash: request.filterHash,
    sort: request.sort,
    postedAt: new Date("2026-07-20T10:00:00.000Z"),
    createdAt: new Date("2026-07-20T09:00:00.000Z"),
    id: "507f1f77bcf86cd799439011",
  });

  assert.deepEqual(decodeJobSearchCursor(cursor, request), {
    cursorDate: new Date("2026-07-20T10:00:00.000Z"),
    createdAt: null,
    id: "507f1f77bcf86cd799439011",
  });
  assert.throws(
    () => decodeJobSearchCursor(cursor, buildJobSearchRequest({ company: ["Other Corp"], sort: "latest" })),
    (error) => error instanceof SearchInputError && error.code === "CURSOR_FILTER_MISMATCH",
  );
});

test("job search cursors reject malformed payloads distinctly from filter mismatches", () => {
  const request = buildJobSearchRequest({});
  assert.throws(
    () => decodeJobSearchCursor("not-a-cursor", request),
    (error) => error instanceof SearchInputError && error.code === "INVALID_CURSOR",
  );
});

test("job search popularity cursors preserve the click boundary", () => {
  const request = buildJobSearchRequest({ sort: "popularity" });
  const cursor = encodeJobSearchCursor({
    filterHash: request.filterHash,
    sort: request.sort,
    postedAt: new Date("2026-07-20T10:00:00.000Z"),
    id: "507f1f77bcf86cd799439011",
    clickCount: 42,
  });

  assert.deepEqual(decodeJobSearchCursor(cursor, request), {
    cursorDate: new Date("2026-07-20T10:00:00.000Z"),
    createdAt: null,
    id: "507f1f77bcf86cd799439011",
    clickCount: 42,
  });
});

test("cursor job search requests one extra projected row and returns an opaque next cursor", async () => {
  const originalAggregate = Job.aggregate;
  let capturedPipeline = null;
  let capturedOptions = null;
  Job.aggregate = (pipeline) => ({
    option(value) { capturedOptions = value; return this; },
    exec: async () => {
      capturedPipeline = pipeline;
      return [
        { _id: "507f1f77bcf86cd799439011", title: "First", postedAt: new Date("2026-07-20T00:00:00.000Z"), sortDate: new Date("2026-07-20T00:00:00.000Z") },
        {
          _id: "507f1f77bcf86cd799439012",
          title: "Second",
          postedAt: new Date("2026-07-19T00:00:00.000Z"),
          sortDate: new Date("2026-07-19T00:00:00.000Z"),
        },
      ];
    },
  });
  try {
    const res = response();
    await getJobSearch({ body: { company: ["Example Corp"], limit: 1 }, user: premiumUser }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedOptions, { maxTimeMS: 800 });
    assert.equal(capturedPipeline[0].$match.status, "active");
    assert.equal(capturedPipeline[0].$match.isPublicIndia, true);
    assert.equal(capturedPipeline[0].$match.$expr.$and.length, 2);
    assert.equal(capturedPipeline.at(-2).$limit, 2);
    assert.deepEqual(capturedPipeline.at(-3).$sort, { sortDate: -1, _id: -1 });
    assert.equal(capturedPipeline.at(-1).$project.title, 1);
    assert.equal(capturedPipeline.at(-1).$project.sortDate, 1);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.pagination.hasNextPage, true);
    assert.equal(typeof res.body.pagination.nextCursor, "string");
    assert.equal(typeof res.body.meta?.requestId, "string");
    assert.equal(typeof res.body.meta?.queryMs, "number");
    assert.equal(res.headers["X-Request-Id"], res.body.meta.requestId);
    assert.match(String(res.headers["Server-Timing"]), /^total;dur=/);
  } finally {
    Job.aggregate = originalAggregate;
  }
});

test("cursor job search rejects unsafe input with a structured 422 response", async () => {
  const res = response();
  await getJobSearch({ body: { $where: "sleep(1000)" }, user: premiumUser }, res);
  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, "UNKNOWN_FILTER");
});

test("cursor job search builds popularity cursors from click-count ordered pages", async () => {
  const originalAggregate = Job.aggregate;
  let capturedPipeline = null;

  Job.aggregate = (pipeline) => ({
    option() { return this; },
    exec: async () => {
      capturedPipeline = pipeline;
      return [
        {
          _id: "507f1f77bcf86cd799439011",
          title: "Most Clicked",
          postedAt: new Date("2026-07-20T00:00:00.000Z"),
          clickCount: 21,
          sortDate: new Date("2026-07-20T00:00:00.000Z"),
        },
        {
          _id: "507f1f77bcf86cd799439012",
          title: "Second Most Clicked",
          postedAt: new Date("2026-07-19T00:00:00.000Z"),
          clickCount: 13,
          sortDate: new Date("2026-07-19T00:00:00.000Z"),
        },
      ];
    },
  });

  try {
    const res = response();
    await getJobSearch({ body: { sort: "popularity", limit: 1 }, user: premiumUser }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(capturedPipeline.at(-3).$sort, { clickCount: -1, sortDate: -1, _id: -1 });
    assert.equal(res.body.data[0].title, "Most Clicked");
    assert.equal(typeof res.body.pagination.nextCursor, "string");
  } finally {
    Job.aggregate = originalAggregate;
  }
});

test("cursor job search accepts GET query parameters for the read-only search path", async () => {
  const originalAggregate = Job.aggregate;
  let capturedPipeline = null;

  Job.aggregate = (pipeline) => ({
    option() { return this; },
    exec: async () => {
      capturedPipeline = pipeline;
      return [
        {
          _id: "507f1f77bcf86cd799439011",
          title: "Backend Engineer",
          company: "Example Corp",
          location: "Bengaluru",
          city: "Bengaluru",
          postedAt: new Date("2026-07-20T00:00:00.000Z"),
          sortDate: new Date("2026-07-20T00:00:00.000Z"),
        },
      ];
    },
  });

  try {
    const res = response();
    await getJobSearch({
      method: "GET",
      query: { company: ["Example Corp"], sort: "latest", limit: "12" },
      user: premiumUser,
    }, res);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(capturedPipeline));
    assert.equal(res.body.data[0].title, "Backend Engineer");
  } finally {
    Job.aggregate = originalAggregate;
  }
});

test("job routes expose authenticated optional GET and POST search endpoints before dynamic job ids", async () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = originalJwtSecret || "x".repeat(32);
  const { default: router } = await import("../src/routes/jobRoutes.js");
  const layers = router.stack.filter((entry) => entry.route?.path === "/search");
  const getLayer = layers.find((entry) => entry.route?.methods.get);
  const postLayer = layers.find((entry) => entry.route?.methods.post);
  assert.ok(getLayer);
  assert.ok(postLayer);
  assert.equal(getLayer.route.stack.at(-1).name, "getJobSearch");
  assert.equal(postLayer.route.stack.at(-1).name, "getJobSearch");
  process.env.JWT_SECRET = originalJwtSecret;
});

test("live hiring companies return only normalized active public company names", async () => {
  const originalDistinct = Job.distinct;
  let capturedFilter = null;
  Job.distinct = async (field, filter) => {
    capturedFilter = filter;
    assert.equal(field, "company");
    return ["  Acme Labs ", "Beta", "Acme Labs", "", null];
  };

  try {
    const res = response();
    await getLiveHiringCompanies({}, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.data.companies, ["Acme Labs", "Beta"]);
    assert.equal(capturedFilter.status, "active");
    assert.equal(capturedFilter.isPublicIndia, true);
    assert.equal(res.headers["Cache-Control"], "no-store");
  } finally {
    Job.distinct = originalDistinct;
  }
});

test("live hiring companies return a safe server error when the query fails", async () => {
  const originalDistinct = Job.distinct;
  Job.distinct = async () => { throw new Error("database unavailable"); };

  try {
    const res = response();
    await getLiveHiringCompanies({}, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
  } finally {
    Job.distinct = originalDistinct;
  }
});

test("job metadata hides the legacy NA date-posted option from public filters", async () => {
  const originalFindOne = JobDatasetSummary.findOne;
  JobDatasetSummary.findOne = (filter) => ({
    sort(spec) {
      assert.deepEqual(filter, { key: "public-active" });
      assert.deepEqual(spec, { _id: 1 });
      return this;
    },
    lean() { return this; },
    exec: async () => ({
      key: "public-active",
      companies: ["Acme Labs"],
      cities: ["Bengaluru"],
      jobTypes: ["Internship"],
    }),
  });

  try {
    const res = response();
    await getJobMeta({ query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.datePostedOptions.includes("na"), false);
    assert.deepEqual(res.body.data.datePostedOptions, [...Array.from({ length: 31 }, (_, index) => index), "older-than-30"]);
  } finally {
    JobDatasetSummary.findOne = originalFindOne;
  }
});

test("unfiltered company suggestions return the full public company directory", () => {
  assert.match(controllerSource, /const MAX_COMPANY_AUTOCOMPLETE_RESULTS = 2000;/);
  assert.match(controllerSource, /const summary = await resolvePublicJobDatasetSummary\(req\.siteSettings\)\.catch\(\(\) => null\);/);
  assert.match(controllerSource, /mergeCompanyOptions\(summary\?\.companies \?\? \[\]\)/);
  assert.match(controllerSource, /limit: MAX_COMPANY_AUTOCOMPLETE_RESULTS/);
});
