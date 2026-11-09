import assert from "node:assert/strict";
import test from "node:test";

import Job from "../src/models/Job.js";
import {
  getCompanies,
  getCompanyByKey,
} from "../src/controllers/companyController.js";

const createResponse = () => ({
  body: null,
  headers: new Map(),
  statusCode: 200,
  set(name, value) {
    this.headers.set(String(name).toLowerCase(), value);
    return this;
  },
  status(value) {
    this.statusCode = value;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});

test("getCompanies returns the public response envelope", async () => {
  const originalAggregate = Job.aggregate;
  Job.aggregate = () => ({
    exec: async () => [{
      companies: [{
        key: "acme",
        name: "Acme",
        domains: [],
        careerPages: [],
        atsPlatforms: [],
        activeJobCount: 1,
        locations: ["Bengaluru"],
        latestPostedAt: null,
      }],
      total: [{ count: 1 }],
    }],
  });

  try {
    const req = {
      query: { q: " Acme ", page: "1", limit: "24" },
      siteSettings: { experiencedJobsEnabled: true },
    };
    const res = createResponse();
    await getCompanies(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(res.body, {
      code: 200,
      success: true,
      data: {
        companies: [{
          key: "acme",
          name: "Acme",
          domain: null,
          careerPage: null,
          atsPlatforms: [],
          activeJobCount: 1,
          locations: ["Bengaluru"],
          latestPostedAt: null,
        }],
        pagination: { page: 1, limit: 24, total: 1, totalPages: 1 },
        query: "Acme",
      },
    });
  } finally {
    Job.aggregate = originalAggregate;
  }
});

test("getCompanyByKey returns the standard not-found envelope", async () => {
  const originalAggregate = Job.aggregate;
  Job.aggregate = () => ({ exec: async () => [] });

  try {
    const req = { params: { companyKey: "missing" }, siteSettings: {} };
    const res = createResponse();
    await getCompanyByKey(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.deepEqual(res.body, {
      code: 404,
      success: false,
      message: "Company not found",
    });
  } finally {
    Job.aggregate = originalAggregate;
  }
});
