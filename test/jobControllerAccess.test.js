import assert from "node:assert/strict";
import test from "node:test";

import Click from "../src/models/Click.js";
import Job from "../src/models/Job.js";
import { ACCESS_ROLES, PLAN_IDS } from "../src/constants/accessPlans.js";
import {
  getAllJobs,
  getJobMeta,
  trackJobClick,
} from "../src/controllers/jobController.js";

const createResponseDouble = () => ({
  statusCode: 200,
  headers: {},
  body: null,
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

const collectExperienceYearsFilters = (node) => {
  if (!node || typeof node !== "object" || node instanceof RegExp) return [];

  const matches = [];
  if (Array.isArray(node.experienceYears?.$in)) {
    matches.push(node.experienceYears.$in);
  }

  for (const key of ["$and", "$or"]) {
    if (Array.isArray(node[key])) {
      for (const child of node[key]) {
        matches.push(...collectExperienceYearsFilters(child));
      }
    }
  }

  return matches;
};

test("free users cannot send premium job filter parameters", async () => {
  const res = createResponseDouble();

  await getAllJobs(
    {
      query: { company: "Google" },
      user: {
        role: "user",
        accessRole: ACCESS_ROLES.FREE,
        premium: {
          planId: PLAN_IDS.FREE,
          status: "inactive",
        },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.premiumRequired, true);
  assert.equal(res.body.feature, "job_filters");
});

test("free users cannot send the experience year premium filter", async () => {
  const res = createResponseDouble();

  await getAllJobs(
    {
      query: { experienceYear: "2" },
      user: {
        role: "user",
        accessRole: ACCESS_ROLES.FREE,
        premium: {
          planId: PLAN_IDS.FREE,
          status: "inactive",
        },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.premiumRequired, true);
  assert.equal(res.body.feature, "job_filters");
});

test("free users cannot send the advanced enrichment filters", async () => {
  const res = createResponseDouble();

  await getAllJobs(
    {
      query: {
        skills: "python,aws",
        roleDomain: "Data Science & AI",
        workArrangement: "Remote",
      },
      user: {
        role: "user",
        accessRole: ACCESS_ROLES.FREE,
        premium: {
          planId: PLAN_IDS.FREE,
          status: "inactive",
        },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.premiumRequired, true);
  assert.equal(res.body.feature, "job_filters");
});

test("free users cannot request scoped job metadata", async () => {
  const res = createResponseDouble();

  await getJobMeta(
    {
      query: { city: "Bangalore" },
      user: {
        role: "user",
        accessRole: ACCESS_ROLES.FREE,
        premium: {
          planId: PLAN_IDS.FREE,
          status: "inactive",
        },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.premiumRequired, true);
  assert.equal(res.body.feature, "job_filters");
});

test("unauthenticated users cannot unlock premium sorting through direct API access", async () => {
  const res = createResponseDouble();

  await getAllJobs(
    {
      query: { sort: "recommended" },
      user: null,
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.premiumRequired, true);
});

test("trackJobClick keeps analytics updates inside the public job scope", async () => {
  const originalClickFindOne = Click.findOne;
  const originalJobFindOneAndUpdate = Job.findOneAndUpdate;
  let capturedFilter = null;

  Click.findOne = () => ({
    lean() {
      return this;
    },
    exec: async () => null,
  });
  Job.findOneAndUpdate = async (filter) => {
    capturedFilter = filter;
    return null;
  };

  try {
    const res = createResponseDouble();

    await trackJobClick(
      {
        params: { id: "507f191e810c19729de860ea" },
        headers: {},
        ip: "127.0.0.1",
        user: null,
      },
      res,
    );

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "Job not found");
    assert.equal(capturedFilter?.status, "active");
    assert.equal(capturedFilter?.isPublicIndia, true);
  } finally {
    Click.findOne = originalClickFindOne;
    Job.findOneAndUpdate = originalJobFindOneAndUpdate;
  }
});

test("legacy jobs route caps the requested card limit at 1000", async () => {
  const originalCountDocuments = Job.countDocuments;
  const originalDistinct = Job.distinct;
  const originalFind = Job.find;
  let capturedLimit = null;

  Job.countDocuments = async () => 24;
  Job.distinct = async () => ["Example Corp"];
  Job.find = () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit(value) {
      capturedLimit = value;
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => [],
  });

  try {
    const res = createResponseDouble();

    await getAllJobs(
      {
        query: { page: "1", limit: "1200" },
        user: {
          role: "user",
          accessRole: ACCESS_ROLES.FREE,
          premium: {
            planId: PLAN_IDS.FREE,
            status: "inactive",
          },
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(capturedLimit, 1000);
    assert.equal(res.body.pagination.limit, 1000);
  } finally {
    Job.countDocuments = originalCountDocuments;
    Job.distinct = originalDistinct;
    Job.find = originalFind;
  }
});

test("legacy jobs route does not clamp page numbers above 2000", async () => {
  const originalCountDocuments = Job.countDocuments;
  const originalDistinct = Job.distinct;
  const originalFind = Job.find;
  let capturedSkip = null;

  Job.countDocuments = async () => 24_012;
  Job.distinct = async () => ["Example Corp"];
  Job.find = () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    skip(value) {
      capturedSkip = value;
      return this;
    },
    limit() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => [],
  });

  try {
    const res = createResponseDouble();

    await getAllJobs({ query: { page: "2001" }, user: null }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(capturedSkip, 24_000);
    assert.equal(res.body.pagination.page, 2001);
  } finally {
    Job.countDocuments = originalCountDocuments;
    Job.distinct = originalDistinct;
    Job.find = originalFind;
  }
});

test("premium users can keep using existing filters while requesting larger job pages", async () => {
  const originalCountDocuments = Job.countDocuments;
  const originalDistinct = Job.distinct;
  const originalFind = Job.find;
  let capturedFilter = null;
  let capturedLimit = null;

  Job.countDocuments = async () => 4;
  Job.distinct = async () => ["Google", "YouTube"];
  Job.find = (filter) => {
    capturedFilter = filter;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit(value) {
        capturedLimit = value;
        return this;
      },
      lean() {
        return this;
      },
      exec: async () => [],
    };
  };

  try {
    const res = createResponseDouble();

    await getAllJobs(
      {
        query: { company: "Google", limit: "40" },
        user: {
          role: "user",
          accessRole: ACCESS_ROLES.MONTHLY,
          premium: {
            planId: PLAN_IDS.MONTHLY,
            status: "active",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(capturedLimit, 40);
    assert.equal(res.body.pagination.limit, 40);
    assert.equal(res.body.pagination.totalCompanies, 2);
    assert.equal(capturedFilter?.companyKey, "google");
  } finally {
    Job.countDocuments = originalCountDocuments;
    Job.distinct = originalDistinct;
    Job.find = originalFind;
  }
});

test("experience year filtering stays in the Mongo query before pagination", async () => {
  const originalCountDocuments = Job.countDocuments;
  const originalDistinct = Job.distinct;
  const originalFind = Job.find;
  let capturedFilter = null;
  let capturedLimit = null;

  Job.countDocuments = async () => 1;
  Job.distinct = async () => ["Example Corp"];
  Job.find = (filter) => {
    capturedFilter = filter;
    return {
      select() {
        return this;
      },
      sort() {
        return this;
      },
      skip() {
        return this;
      },
      limit(value) {
        capturedLimit = value;
        return this;
      },
      lean() {
        return this;
      },
      exec: async () => [
        {
          title: "Platform Engineer",
          company: "Example Corp",
          experienceYears: [3, 4, 5],
        },
      ],
    };
  };

  try {
    const res = createResponseDouble();

    await getAllJobs(
      {
        query: { experienceYear: "3", limit: "12" },
        user: {
          role: "user",
          accessRole: ACCESS_ROLES.MONTHLY,
          premium: {
            planId: PLAN_IDS.MONTHLY,
            status: "active",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(capturedLimit, 12);
    assert.equal(
      collectExperienceYearsFilters(capturedFilter)
        .some((years) => years.includes(3)),
      true,
    );
  } finally {
    Job.countDocuments = originalCountDocuments;
    Job.distinct = originalDistinct;
    Job.find = originalFind;
  }
});

test("job list queries select only fields needed for cards", async () => {
  const originalCountDocuments = Job.countDocuments;
  const originalDistinct = Job.distinct;
  const originalFind = Job.find;
  let capturedProjection = null;

  Job.countDocuments = async () => 1;
  Job.distinct = async () => ["Example Corp"];
  Job.find = () => ({
    select(projection) {
      capturedProjection = projection;
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => [
      {
        _id: "job-1",
        title: "Frontend Intern",
        company: "Example Corp",
      },
    ],
  });

  try {
    const res = createResponseDouble();

    await getAllJobs(
      {
        query: {},
        user: {
          role: "user",
          accessRole: ACCESS_ROLES.MONTHLY,
          premium: {
            planId: PLAN_IDS.MONTHLY,
            status: "active",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(capturedProjection.title, 1);
    assert.equal(capturedProjection.company, 1);
    assert.equal(capturedProjection.jobSkills, 1);
    assert.ok(capturedProjection._publicJobType);
    assert.equal(capturedProjection.description, undefined);
    assert.equal(capturedProjection.minimumQualification, undefined);
    assert.equal(capturedProjection.preferredQualification, undefined);
  } finally {
    Job.countDocuments = originalCountDocuments;
    Job.distinct = originalDistinct;
    Job.find = originalFind;
  }
});
