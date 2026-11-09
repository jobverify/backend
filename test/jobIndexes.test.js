import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";

import Job from "../src/models/Job.js";

const getJobIndexes = () => Job.schema.indexes().map(([key, options]) => ({
  key,
  options: options ?? {},
}));

const hasIndex = (expectedKey) => getJobIndexes().some(({ key }) => (
  isDeepStrictEqual(key, expectedKey)
));

test("Job schema has a deterministic latest/oldest sort index", () => {
  assert.equal(
    hasIndex({ status: 1, isPublicIndia: 1, sortDate: -1, _id: -1 }),
    true,
  );
});

test("Job schema has a deterministic popularity sort index", () => {
  assert.equal(
    hasIndex({ status: 1, isPublicIndia: 1, clickCount: -1, sortDate: -1, _id: -1 }),
    true,
  );
});

test("Job schema can filter by experience year and keep latest ordering stable", () => {
  assert.equal(
    hasIndex({ status: 1, isPublicIndia: 1, experienceYears: 1, sortDate: -1, _id: -1 }),
    true,
  );
});

test("Job schema has equality-key indexes for common company and location filters", () => {
  assert.equal(
    hasIndex({ status: 1, isPublicIndia: 1, companyKey: 1, sortDate: -1, _id: -1 }),
    true,
  );
  assert.equal(
    hasIndex({ status: 1, isPublicIndia: 1, locationKeys: 1, sortDate: -1, _id: -1 }),
    true,
  );
  assert.equal(
    hasIndex({ status: 1, isPublicIndia: 1, companyKey: 1, locationKeys: 1, sortDate: -1, _id: -1 }),
    true,
  );
});

test("Job schema can advance source lifecycle misses without scanning all jobs", () => {
  assert.equal(
    hasIndex({ source: 1, status: 1, missedScrapeCount: 1 }),
    true,
  );
});

test("Job text search index stays bounded to card-sized search fields", () => {
  const textIndex = getJobIndexes().find(({ options }) => (
    options.name === "job_search_text"
  ));

  assert.ok(textIndex);
  assert.deepEqual(textIndex.key, {
    title: "text",
    company: "text",
    experienceRequired: "text",
    requiredSkills: "text",
  });
});
