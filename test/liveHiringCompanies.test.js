import assert from "node:assert/strict";
import test from "node:test";

import Job from "../src/models/Job.js";
import { getLiveHiringCompanies } from "../src/controllers/jobController.js";

const response = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  set(name, value) {
    this.headers[name] = value;
    return this;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

test("live hiring companies return normalized distinct companies from active public jobs", async () => {
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
    assert.deepEqual(res.body, {
      code: 200,
      success: true,
      data: { companies: ["Acme Labs", "Beta"] },
    });
    assert.equal(capturedFilter.status, "active");
    assert.equal(capturedFilter.isPublicIndia, true);
    assert.equal(res.headers["Cache-Control"], "no-store");
  } finally {
    Job.distinct = originalDistinct;
  }
});

test("live hiring companies return a safe error when the database query fails", async () => {
  const originalDistinct = Job.distinct;
  Job.distinct = async () => {
    throw new Error("database unavailable");
  };

  try {
    const res = response();
    await getLiveHiringCompanies({}, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, "Server error while fetching live hiring companies");
  } finally {
    Job.distinct = originalDistinct;
  }
});
