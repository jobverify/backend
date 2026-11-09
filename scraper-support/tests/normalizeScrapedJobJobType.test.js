import assert from "node:assert/strict";
import test from "node:test";

import { resolveJobType } from "../utils/normalizeScrapedJob.js";

test("resolveJobType preserves unresolved experience for common full-time source labels", () => {
  for (const employmentType of [
    "Full time",
    "Full Time",
    "FULL_TIME",
    "Full-Time",
    "Permanent",
    "Regular",
    "Unlimited",
    "Full Time Employee",
    "FTE",
  ]) {
    assert.equal(
      resolveJobType({ employmentType, title: "Software Engineer" }),
      "Unspecified",
      employmentType,
    );
  }
});

test("resolveJobType classifies every label containing contract as contract", () => {
  for (const employmentType of [
    "Fixed-term contract",
    "Contractual",
    "Permanent Contract",
    "Project-specific contract",
    "Trainee on contract",
    "Full-time or Contract",
  ]) {
    assert.equal(resolveJobType({ employmentType, title: "Software Engineer" }), "Contract", employmentType);
  }
});

test("resolveJobType does not manufacture experience for permanent and employment labels", () => {
  for (const employmentType of [
    "Professional",
    "On-site with Flexibility",
    "Permanent Full-Time",
    "Regular - Permanent",
    "Business Regular",
    "Full Time Employee",
    "Full-time Employment",
    "Employee",
    "Full Time Employees",
    "Permanent Full Time",
    "Employee - Regular",
    "Full-Time Employment",
    "Full Time Employment",
    "Regular Full Time",
    "Permanant (Full Time)",
  ]) {
    assert.equal(
      resolveJobType({ employmentType, title: "Software Engineer" }),
      "Unspecified",
      employmentType,
    );
  }
});

test("resolveJobType leaves work-arrangement and unknown labels without invented experience", () => {
  for (const employmentType of ["Onsite", "Hybrid", "Remote Local", "J"]) {
    assert.equal(resolveJobType({ employmentType, title: "Software Engineer" }), "Unspecified", employmentType);
  }
});

test("resolveJobType classifies zero experience roles by internship and fresher evidence", () => {
  assert.equal(
    resolveJobType({ employmentType: "Hybrid", title: "Engineering Intern", experienceRequired: "0 years" }),
    "Internship",
  );
  assert.equal(
    resolveJobType({ employmentType: "Onsite", title: "Graduate Software Engineer", experienceRequired: "0 years" }),
    "Full-time Fresher",
  );
});
