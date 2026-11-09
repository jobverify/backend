import assert from "node:assert/strict";
import test from "node:test";

import { WORK_ARRANGEMENT_OPTIONS } from "../src/constants/jobFilterTaxonomy.js";
import { extractJobFilterSignals } from "../src/utils/jobFilterSignals.js";

test("work arrangement taxonomy and extraction exclude Flexible", () => {
  const signals = extractJobFilterSignals({
    title: "Operations Specialist",
    workArrangement: "Flexible",
  });

  assert.ok(!WORK_ARRANGEMENT_OPTIONS.includes("Flexible"));
  assert.equal(signals.workArrangement, "On-site");
});

test("ambiguous work arrangements still use source evidence before defaulting to On-site", () => {
  for (const workArrangement of [undefined, "Flexible", "Not specified"]) {
    for (const [description, expected] of [
      ["This is a remote role based in India.", "Remote"],
      ["This role follows a hybrid work arrangement.", "Hybrid"],
      ["Develop software for our products.", "On-site"],
    ]) {
      const signals = extractJobFilterSignals({ title: "Engineer", workArrangement, description });
      assert.equal(signals.workArrangement, expected);
      assert.equal(signals.filterSignals.confidence.workArrangement, expected === "On-site" ? "low" : "high");
    }
  }
});

test("extractJobFilterSignals classifies required and preferred skills with domain, seniority, and experience signals", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Backend Engineer",
    location: "Hybrid - Bengaluru, India",
    description: [
      "Build backend APIs and distributed services for a payments platform.",
      "Responsibilities include Java microservices, AWS deployment, and PostgreSQL optimization.",
      "Preferred Qualifications: Kubernetes and Kafka experience.",
    ].join(" "),
    minimumQualification: "Required skills: Java, Spring Boot, AWS, PostgreSQL.",
    preferredQualification: "Preferred: Kubernetes, Kafka.",
    requiredSkills: ["Java", "Spring Boot", "AWS"],
    experienceRequired: "3 to 5 years of backend engineering experience",
  });

  assert.equal(signals.experienceBucket, "3-5");
  assert.equal(signals.experienceProfile.minimumYears, 3);
  assert.equal(signals.experienceProfile.maximumYears, 5);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.deepEqual(signals.experienceYears, [3, 4, 5]);
  assert.equal(signals.experienceProfile.confidence, "high");
  assert.equal(signals.seniority, "Senior");
  assert.equal(signals.primaryRoleDomain, "Backend Engineering");
  assert.equal(signals.workArrangement, "Hybrid");
  assert.deepEqual(signals.requiredSkillIds, ["java", "spring-boot", "aws", "postgresql"]);
  assert.deepEqual(signals.preferredSkillIds, ["kubernetes", "kafka"]);
  assert.deepEqual(
    signals.skillIds,
    ["java", "spring-boot", "aws", "postgresql", "kubernetes", "kafka"],
  );
});

test("extractJobFilterSignals expands arbitrary bounded ranges into experienceYears", () => {
  const signals = extractJobFilterSignals({
    title: "Platform Engineer",
    experienceRequired: "4-6 years of platform engineering experience",
  });

  assert.equal(signals.experienceProfile.minimumYears, 4);
  assert.equal(signals.experienceProfile.maximumYears, 6);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.deepEqual(signals.experienceYears, [4, 5, 6]);
});

test("SQL requires its own source token and is not inferred from PostgreSQL", () => {
  assert.deepEqual(extractJobFilterSignals({ description: "Use PostgreSQL for application storage." }).skillIds, ["postgresql"]);
  assert.deepEqual(extractJobFilterSignals({ description: "Use SQL for reporting queries." }).skillIds, ["sql"]);
  assert.deepEqual(extractJobFilterSignals({ description: "Use PostgreSQL and SQL for reporting queries." }).skillIds, ["postgresql", "sql"]);
});

test("extractJobFilterSignals expands open-ended ranges into capped experienceYears", () => {
  const signals = extractJobFilterSignals({
    title: "Principal Engineer",
    experienceRequired: "5+ years of engineering leadership experience",
  });

  assert.equal(signals.experienceProfile.minimumYears, 5);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.deepEqual(signals.experienceYears, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
});

test("extractJobFilterSignals parses label-prefixed more-than experience phrasing", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Manager",
    description: "Experience : More than 8 years in powertrain manufacturing operations.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 8);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "8+ years");
});

test("extractJobFilterSignals parses min-max labels between numeric year values", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Manager - Current Quality",
    description: "Work Experience Min-10 years Maxx-15 Years Tata Motors Leadership Competencies",
  });

  assert.equal(signals.experienceProfile.minimumYears, 10);
  assert.equal(signals.experienceProfile.maximumYears, 15);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "10-15 years");
});

test("extractJobFilterSignals parses bare years-of-experience labels followed by a single value", () => {
  const signals = extractJobFilterSignals({
    title: "Associate",
    description: "Mandatory Skills: Consulting Preferred Skills: Energy, Utilities & Resources Years of Experience: 1 QUALIFICATIONS: MBA/PG",
  });

  assert.equal(signals.experienceProfile.minimumYears, 1);
  assert.equal(signals.experienceProfile.maximumYears, 1);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "1 year");
});

test("extractJobFilterSignals parses bare experience labels followed by an exact numeric value", () => {
  const signals = extractJobFilterSignals({
    title: "Associate",
    description: "Experience: 1 Qualification: Graduate",
  });

  assert.equal(signals.experienceProfile.minimumYears, 1);
  assert.equal(signals.experienceProfile.maximumYears, 1);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "1 year");
});

test("extractJobFilterSignals treats bare numeric ranges from the dedicated experience field as years", () => {
  const signals = extractJobFilterSignals({
    title: "EV Engineering - Fellowship",
    experienceRequired: "0 - 1",
  });

  assert.equal(signals.experienceProfile.minimumYears, 0);
  assert.equal(signals.experienceProfile.maximumYears, 1);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "0-1 years");
  assert.equal(signals.experienceBucket, "0-1");
});

test("extractJobFilterSignals treats bare plus values from the dedicated experience field as years", () => {
  const signals = extractJobFilterSignals({
    title: "Area Sales Manager",
    experienceRequired: "5+",
  });

  assert.equal(signals.experienceProfile.minimumYears, 5);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "5+ years");
  assert.equal(signals.experienceBucket, "3-5");
});

test("extractJobFilterSignals parses between-and experience ranges from descriptive text", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Software Engineer - Android",
    description: "Your Experience Across The Years in the Roles You’ve Played - Total work experience between 4 and 5 years.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 4);
  assert.equal(signals.experienceProfile.maximumYears, 5);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "4-5 years");
});

test("extractJobFilterSignals parses open-ended experience labels that use greater-than comparators", () => {
  const signals = extractJobFilterSignals({
    title: "Associate General Manager-Supply Chain",
    description: "Relevant Experience >12 years and shall have independently led supply chain functions.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 12);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "12+ years");
});

test("extractJobFilterSignals parses minimum experience requirement labels with exact year values", () => {
  const signals = extractJobFilterSignals({
    title: "PAT Engineer- A&U",
    description: "Minimum experience requirement 2 Years Working knowledge requirement Expertise in Digital Ergonomics.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 2);
  assert.equal(signals.experienceProfile.maximumYears, 2);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "2 years");
});

test("extractJobFilterSignals prefers the primary minimum-years requirement over smaller secondary role clauses", () => {
  const signals = extractJobFilterSignals({
    title: "Engineering Manager",
    description: "Qualifications/ Essentials Skills/ Experience Bachelor’s or Master’s degree in Computer Science, Engineering, or a related field. Minimum of 8 years of proven experience in software engineering, with at least 2 years in an engineering management role.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 8);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "8+ years");
});

test("extractJobFilterSignals tolerates collapsed list markers after open-ended year values", () => {
  const signals = extractJobFilterSignals({
    title: "Module Lead - .Net Core , C#, WPF",
    description: "Software development experience of 5+ yearso Strong hands-on experience on Object Oriented Design.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 5);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "5+ years");
});

test("extractJobFilterSignals parses open-ended plus shorthand when the unit is omitted before experience", () => {
  const signals = extractJobFilterSignals({
    title: "Interoperability Software Architect",
    description: "You are fit if: 14+ experience in Software Development, Software Design and Architecture, Testing and Quality Assurance or equivalent.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 14);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "14+ years");
});

test("extractJobFilterSignals parses atleast phrasing with apostrophized year units", () => {
  const signals = extractJobFilterSignals({
    title: "Data Management Associate",
    description: "Possess atleast 5 years’ experience in a Data Management role with knowledge of sales processes.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 5);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "5+ years");
});

test("extractJobFilterSignals parses candidate-cued over-year phrasing as open-ended experience", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Member Technical",
    description: "Essential Over 4 years’ relevant software development experience Strong proficiency in .NET C# applications development.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 4);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "4+ years");
});

test("extractJobFilterSignals parses year ranges phrased as experienced candidates", () => {
  const signals = extractJobFilterSignals({
    title: "Strategic Sales Business Analyst",
    description: "Ideal Candidate Profile MBA from a top-tier B-school 1 or 2 years experienced grads with commercial savviness.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 1);
  assert.equal(signals.experienceProfile.maximumYears, 2);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "1-2 years");
});

test("extractJobFilterSignals parses or-more experience phrasing as open-ended requirements", () => {
  const signals = extractJobFilterSignals({
    title: "Research Analyst",
    description: "Minimum 1 or more years of experience in KYC/AML. Be effective in finding data from a number of sources.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 1);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "1+ years");
});

test("extractJobFilterSignals parses word-based year ranges after number-word normalization", () => {
  const signals = extractJobFilterSignals({
    title: "Hardware Design Architect - DevOps R&D IT",
    description: "Master’s degree or equivalent practical experience in Software Engineering Ten to fifteen years of experience working in chip design industry and/or IT EDA field.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 10);
  assert.equal(signals.experienceProfile.maximumYears, 15);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "10-15 years");
});

test("extractJobFilterSignals parses labeled minimum values when the year token is split apart", () => {
  const signals = extractJobFilterSignals({
    title: "Manager Carbon/Green hydrogen Decarbonization Advisory Gurgaon",
    description: "Years of experience required : Minimum 7 y ears Education qualification: B.tech + MBA",
  });

  assert.equal(signals.experienceProfile.minimumYears, 7);
  assert.equal(signals.experienceProfile.maximumYears, 7);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "7 years");
});

test("extractJobFilterSignals parses bracketed single-value year requirements", () => {
  const signals = extractJobFilterSignals({
    title: "Director, Accounting",
    description: "All About You: Minimum of [12] years of experience in a senior leadership role within global business services.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 12);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "12+ years");
});

test("extractJobFilterSignals parses parenthesized numeric ranges after number-word normalization", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Technical Lead-Generator Excitation Solutions",
    description: "Eight (8) to sixteen (16) years of experience in generator excitation systems, power electronics, and related applications.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 8);
  assert.equal(signals.experienceProfile.maximumYears, 16);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "8-16 years");
});

test("extractJobFilterSignals parses collapsed parenthesized open-ended years of experience", () => {
  const signals = extractJobFilterSignals({
    title: "DCS Engineer",
    description: "Who You Are: Ten(10)+ years of experience in DCS/PLC programming, engineering and commissioning.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 10);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "10+ years");
});

test("extractJobFilterSignals parses abbreviated minimum year values in domain contexts", () => {
  const signals = extractJobFilterSignals({
    title: "IMp@CT- SAP S/4 HANA Roll-out Coordinator- CO",
    description: "Required Qualifications: Min. 7 yrs in SAP environment for min one relevant SAP module. Min. 3 yrs in a multinational environment.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 7);
  assert.equal(signals.experienceProfile.maximumYears, 7);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "7 years");
});

test("extractJobFilterSignals preserves late plus-valued requirements after company-profile copy", () => {
  const signals = extractJobFilterSignals({
    title: "Data Engineer(Consultant)-3",
    company: "CDW",
    description: "At CDW, we make it happen, together. Coworkers who genuinely believe in supporting our customers and one another. About us. Summary We are seeking a consultant - Data Engineering. Required Qualifications 2+ years of experience in Data Engineering. Strong expertise in SQL and data warehousing concepts.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 2);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "2+ years");
});

test("extractJobFilterSignals preserves late job-position experience labels after about-us navigation copy", () => {
  const signals = extractJobFilterSignals({
    title: "Project Lead - FPGA",
    company: "Logic Fruit Technologies",
    description: "Home / About Us / Career / Current Openings / FPGA Project Lead Job Position : Project Lead (FPGA) Experience : 6+ Years Location : Gurugram/Bengaluru. Requirements: 6+ years of experience, including successful completion of FPGA based projects.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 6);
  assert.equal(signals.experienceProfile.maximumYears, 6);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "6 years");
});

test("extractJobFilterSignals preserves late mixed-unit ranges after who-we-are-looking-for sections", () => {
  const signals = extractJobFilterSignals({
    title: "Analyst - India Partner Network (IPN)",
    company: "Sattva",
    description: "About Sattva We partner to deliver social impact at scale across advisory services and platform programs. Who we are looking for Must-Haves -- 6 months to 1yr of experience in program coordination, project management, or operations.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 0.5);
  assert.equal(signals.experienceProfile.maximumYears, 1);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.equal(signals.experienceProfile.evidence, "6 months - 1 year");
});

test("extractJobFilterSignals parses candidate-cued minimum years in domain requirements even with minimum typos", () => {
  const signals = extractJobFilterSignals({
    title: "Software Engineer III",
    description: "Good English communication skills. Must have Miniumum 2 years in Bazel and Nix. Additional assets include experience with cloud platforms and Linux.",
  });

  assert.equal(signals.experienceProfile.minimumYears, 2);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.isOpenEnded, true);
  assert.equal(signals.experienceProfile.evidence, "2+ years");
});

test("extractJobFilterSignals does not mistake company-history experience claims for job requirements", () => {
  const signals = extractJobFilterSignals({
    title: "Technical Lead, Software Development",
    description: "KLA has over 40 years of semiconductor process control experience and serves customers around the world.",
  });

  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.evidence, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals does not mistake team-marketing experience copy for a job requirement", () => {
  const signals = extractJobFilterSignals({
    title: "Senior Executive - Implant",
    description: "About the Team Quess Staffing Solutions – Who we are Quess Staffing Solutions was incepted in 2007, with the vision of bringing human potential one step closer to powerhouse businesses. Today, we are an agile, technology-driven business with a versatile portfolio developed to support the entire spectrum of human resource requirements of clients in a fast-paced setup. 20 years of enriching and flexible experience.",
  });

  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceProfile.evidence, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals captures meaningful non-numeric experience requirements", () => {
  const signals = extractJobFilterSignals({
    title: "MTS III Android Developer",
    description: "Responsibilities Role Requirements: Extensive experience in Android application development using Kotlin. Strong experience with both Jetpack Compose and traditional Android View-based UI development, including custom UI components.",
  });

  assert.equal(
    signals.experienceProfile.evidence,
    "Extensive experience in Android application development using Kotlin",
  );
  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals treats generic explicit experience labels as specified experience", () => {
  const signals = extractJobFilterSignals({
    title: "Software Engineer",
    experienceRequired: "Experienced",
  });

  assert.equal(signals.experienceProfile.evidence, "Experienced");
  assert.equal(signals.experienceProfile.hasExplicitExperience, true);
  assert.equal(signals.experienceProfile.confidence, "medium");
  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals captures preferred non-numeric experience requirements", () => {
  const signals = extractJobFilterSignals({
    title: "Content Writer - Tamil - Remote",
    description: "Qualifications Prior writing experience preferred (professional, academic, or published work). Strong command of style, tone, and structure appropriate to the chosen domain.",
  });

  assert.equal(
    signals.experienceProfile.evidence,
    "Prior writing experience preferred (professional, academic, or published work)",
  );
  assert.equal(signals.experienceProfile.confidence, "medium");
  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals ignores non-requirement experience marketing copy", () => {
  const signals = extractJobFilterSignals({
    title: "Group Product Manager",
    description: "Our mission is to create the most delightful customer experience and help travellers experience the world. We're building toward 2x in two years and 5x in five.",
  });

  assert.equal(signals.experienceProfile.evidence, null);
  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals ignores bare skill experience phrases without requirement cues", () => {
  const signals = extractJobFilterSignals({
    title: "SAP SuccessFactors / LMS SMEs",
    description: [
      "Leave policies allow for 32 days of leave per year.",
      "SAP SuccessFactors / LMS SMEs Remote Contracted Experienced Share ROLE:",
      "Location: Remote contract (1 year).",
      "We are looking for senior-level professionals with experience in SuccessFactors Employee Central and LMS.",
    ].join(" "),
  });

  assert.equal(signals.experienceProfile.evidence, null);
  assert.equal(signals.experienceProfile.minimumYears, null);
  assert.equal(signals.experienceProfile.maximumYears, null);
  assert.equal(signals.experienceBucket, "unspecified");
});

test("extractJobFilterSignals avoids ambiguous false-positive skill aliases", () => {
  const signals = extractJobFilterSignals({
    title: "Customer Success Specialist",
    description: [
      "Help new clients react quickly to onboarding issues.",
      "Own spring planning notes and go-live coordination.",
      "Build customer trust and improve support metrics.",
    ].join(" "),
    location: "On-site - Chennai, India",
  });

  assert.deepEqual(signals.skillIds, []);
  assert.equal(signals.primaryRoleDomain, "Sales & Customer Success");
  assert.equal(signals.workArrangement, "On-site");
});

test("extractJobFilterSignals treats entry-level and no-experience wording as early-career signals", () => {
  const signals = extractJobFilterSignals({
    title: "Graduate Software Engineer",
    location: "Remote, India",
    description: "Entry-level role. No prior experience required. Work with React and TypeScript.",
    experienceRequired: "No prior experience required",
  });

  assert.equal(signals.experienceBucket, "0-1");
  assert.equal(signals.experienceProfile.minimumYears, 0);
  assert.equal(signals.experienceProfile.maximumYears, 0);
  assert.equal(signals.experienceProfile.isOpenEnded, false);
  assert.deepEqual(signals.experienceYears, [0]);
  assert.equal(signals.seniority, "Entry Level");
  assert.equal(signals.workArrangement, "Remote");
  assert.deepEqual(signals.skillIds, ["react", "typescript"]);
});
