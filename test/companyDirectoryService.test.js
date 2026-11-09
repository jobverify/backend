import assert from "node:assert/strict";
import test from "node:test";

import Job from "../src/models/Job.js";
import {
  getPublicCompanyByKey,
  listPublicCompanies,
} from "../src/services/companyDirectoryService.js";

const companyFixture = {
  key: "acme labs",
  name: "Acme Labs",
  domains: [null, "acme.test", ""],
  careerPages: ["https://acme.test/careers", null],
  atsPlatforms: ["workday", null, "workday"],
  activeJobCount: 2,
  locations: ["Bengaluru", null, "Bengaluru", "Hyderabad"],
  jobTypes: ["Full-time Experienced", "Internship", null],
  roleDomains: ["Software Engineering", null],
  workArrangements: ["Hybrid", "On-site", null],
  latestPostedAt: new Date("2026-09-13T00:00:00.000Z"),
};

const createFindStub = ({ jobs, capture }) => (filter) => {
  capture.filter = filter;
  return {
    select(fields) {
      capture.fields = fields;
      return this;
    },
    sort(specification) {
      capture.sort = specification;
      return this;
    },
    limit(value) {
      capture.limit = value;
      return this;
    },
    lean() {
      return this;
    },
    exec: async () => jobs,
  };
};

test("listPublicCompanies applies public visibility, escapes search, and normalizes grouped fields", async () => {
  const originalAggregate = Job.aggregate;
  let capturedPipeline;

  Job.aggregate = (pipeline) => {
    capturedPipeline = pipeline;
    return {
      exec: async () => [{
        companies: [companyFixture],
        total: [{ count: 49 }],
      }],
    };
  };

  try {
    const result = await listPublicCompanies({
      query: "  Acme (India)+  ",
      page: 2,
      limit: 24,
      siteSettings: { experiencedJobsEnabled: false },
    });

    const match = capturedPipeline[0].$match;
    assert.equal(match.status, "active");
    assert.equal(match.isPublicIndia, true);
    assert.equal(match.companyKey.$type, "string");
    assert.equal(match.companyKey.$regex.source, "\\S");
    assert.equal(match.$or.length, 3);
    assert.equal(match.$or[0].company.source, "Acme \\(India\\)\\+");
    assert.equal(match.$or[0].company.flags, "i");
    assert.equal(Boolean(match.$expr), true);
    assert.equal(
      JSON.stringify(match.$expr).includes("Full-time Experienced"),
      true,
    );

    const facet = capturedPipeline.at(-1).$facet;
    assert.deepEqual(facet.companies.slice(-2), [{ $skip: 24 }, { $limit: 24 }]);
    const locationStage = capturedPipeline.find((stage) => stage.$set?.companyDirectoryLocations);
    assert.equal(
      locationStage.$set.companyDirectoryLocations.$setUnion[0].$cond[1],
      "$locations",
    );
    const projectionStage = capturedPipeline.find((stage) => stage.$project?.sortName);
    assert.deepEqual(projectionStage.$project.locations.$reduce.initialValue, []);
    assert.equal(projectionStage.$project.name, 1);
    assert.equal(projectionStage.$project.sortName.$toLower, "$name");
    const groupStage = capturedPipeline.find((stage) => stage.$group);
    assert.equal(groupStage.$group.name.$min, "$companyDirectoryName");

    assert.deepEqual(result, {
      companies: [{
        key: "acme labs",
        name: "Acme Labs",
        domain: "acme.test",
        careerPage: "https://acme.test/careers",
        atsPlatforms: ["workday"],
        activeJobCount: 2,
        locations: ["Bengaluru", "Hyderabad"],
        latestPostedAt: new Date("2026-09-13T00:00:00.000Z"),
      }],
      pagination: {
        page: 2,
        limit: 24,
        total: 49,
        totalPages: 3,
      },
      query: "Acme (India)+",
    });
  } finally {
    Job.aggregate = originalAggregate;
  }
});

test("listPublicCompanies clamps pagination inputs to the public contract", async () => {
  const originalAggregate = Job.aggregate;
  let capturedPipeline;

  Job.aggregate = (pipeline) => {
    capturedPipeline = pipeline;
    return { exec: async () => [{ companies: [], total: [] }] };
  };

  try {
    const result = await listPublicCompanies({ page: -4, limit: 999 });
    const facet = capturedPipeline.at(-1).$facet;

    assert.deepEqual(facet.companies.slice(-2), [{ $skip: 0 }, { $limit: 48 }]);
    assert.deepEqual(result.pagination, {
      page: 1,
      limit: 48,
      total: 0,
      totalPages: 0,
    });
  } finally {
    Job.aggregate = originalAggregate;
  }
});

test("getPublicCompanyByKey returns safe company data and at most six current roles", async () => {
  const originalAggregate = Job.aggregate;
  const originalFind = Job.find;
  let capturedPipeline;
  const findCapture = {};
  const jobs = Array.from({ length: 7 }, (_, index) => ({
    _id: `job-${index + 1}`,
    title: `Role ${index + 1}`,
    company: "Acme Labs",
    city: "Bengaluru",
    locations: ["Bengaluru"],
    jobType: "Internship",
    primaryRoleDomain: "Software Engineering",
    workArrangement: "Hybrid",
    postedAt: new Date("2026-09-13T00:00:00.000Z"),
    description: "must not be returned",
    applyUrl: "https://example.test/private-shape",
  }));

  Job.aggregate = (pipeline) => {
    capturedPipeline = pipeline;
    return { exec: async () => [companyFixture] };
  };
  Job.find = createFindStub({ jobs, capture: findCapture });

  try {
    const result = await getPublicCompanyByKey({
      companyKey: "acme labs",
      siteSettings: {},
    });

    assert.equal(capturedPipeline[0].$match.companyKey, "acme labs");
    assert.equal(capturedPipeline[0].$match.status, "active");
    assert.equal(capturedPipeline[0].$match.isPublicIndia, true);
    assert.equal(findCapture.filter.companyKey, "acme labs");
    assert.equal(findCapture.limit, 6);
    assert.equal(findCapture.fields.includes("description"), false);
    assert.equal(findCapture.fields.includes("applyUrl"), false);
    assert.deepEqual(findCapture.sort, { sortDate: -1, _id: -1 });

    assert.deepEqual(result.company, {
      key: "acme labs",
      name: "Acme Labs",
      domain: "acme.test",
      careerPage: "https://acme.test/careers",
      atsPlatforms: ["workday"],
      activeJobCount: 2,
      locations: ["Bengaluru", "Hyderabad"],
      jobTypes: ["Full-time Experienced", "Internship"],
      roleDomains: ["Software Engineering"],
      workArrangements: ["Hybrid", "On-site"],
      latestPostedAt: new Date("2026-09-13T00:00:00.000Z"),
    });
    assert.equal(result.recentJobs.length, 6);
    assert.deepEqual(result.recentJobs[0], {
      id: "job-1",
      title: "Role 1",
      company: "Acme Labs",
      city: "Bengaluru",
      locations: ["Bengaluru"],
      jobType: "Internship",
      roleDomain: "Software Engineering",
      workArrangement: "Hybrid",
      postedAt: new Date("2026-09-13T00:00:00.000Z"),
    });
    assert.equal("description" in result.recentJobs[0], false);
    assert.equal("applyUrl" in result.recentJobs[0], false);
  } finally {
    Job.aggregate = originalAggregate;
    Job.find = originalFind;
  }
});

test("getPublicCompanyByKey returns null without querying jobs for an unknown company", async () => {
  const originalAggregate = Job.aggregate;
  const originalFind = Job.find;
  let findCalled = false;

  Job.aggregate = () => ({ exec: async () => [] });
  Job.find = () => {
    findCalled = true;
    throw new Error("unexpected job query");
  };

  try {
    const result = await getPublicCompanyByKey({ companyKey: "missing" });
    assert.equal(result, null);
    assert.equal(findCalled, false);
  } finally {
    Job.aggregate = originalAggregate;
    Job.find = originalFind;
  }
});
