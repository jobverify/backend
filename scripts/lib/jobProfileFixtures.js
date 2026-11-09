import { ROLE_DOMAIN_OPTIONS, TAXONOMY_VERSION, EXTRACTION_VERSION } from "../../src/constants/jobFilterTaxonomy.js";
import { buildJobDerivedFields } from "../../src/utils/jobDerivedFields.js";
import { buildJobSearchKeys } from "../../src/utils/jobSearchKeys.js";

const DEFAULT_TOTAL_JOBS = 1800;
const ACTIVE_JOB_COUNT = 1720;
const NON_PUBLIC_ACTIVE_JOB_COUNT = 80;
const EXPIRED_JOB_COUNT = 30;
const FIXTURE_TIMESTAMP_FIELDS = [
  "postedAt", "sortDate", "scrapedAt", "scrapedTimestamp",
  "lastSeenAt", "createdAt", "updatedAt", "extractedAt",
];

const INDIA_CITIES = Object.freeze([
  { city: "Bangalore", state: "Karnataka" },
  { city: "Hyderabad", state: "Telangana" },
  { city: "Pune", state: "Maharashtra" },
  { city: "Chennai", state: "Tamil Nadu" },
  { city: "Mumbai", state: "Maharashtra" },
  { city: "Delhi", state: "Delhi" },
  { city: "Noida", state: "Uttar Pradesh" },
  { city: "Gurgaon", state: "Haryana" },
  { city: "Kolkata", state: "West Bengal" },
  { city: "Ahmedabad", state: "Gujarat" },
  { city: "Jaipur", state: "Rajasthan" },
  { city: "Kochi", state: "Kerala" },
]);

const NON_PUBLIC_LOCATIONS = Object.freeze([
  { city: "London", state: "England", country: "United Kingdom" },
  { city: "Berlin", state: "Berlin", country: "Germany" },
  { city: "New York", state: "New York", country: "United States" },
  { city: "Singapore", state: "Singapore", country: "Singapore" },
]);

const JOB_TYPES = Object.freeze([
  "Internship",
  "Full-time Fresher",
  "Full-time Experienced",
  "Contract",
]);

const WORK_ARRANGEMENTS = Object.freeze([
  "Remote",
  "Hybrid",
  "On-site",
  "Not specified",
]);

const ROLE_DOMAINS = Object.freeze([
  "Software Engineering",
  "Frontend Engineering",
  "Backend Engineering",
  "Full-Stack Engineering",
  "Data Engineering",
  "Data Science & AI",
  "DevOps & SRE",
  "Product & Program Management",
]);

const EXPERIENCE_PROFILES = Object.freeze([
  { years: [0], bucket: "0-1", seniority: "Internship" },
  { years: [1], bucket: "0-1", seniority: "Entry Level" },
  { years: [2, 3], bucket: "1-3", seniority: "Associate" },
  { years: [3, 4], bucket: "3-5", seniority: "Mid Level" },
  { years: [5, 6], bucket: "5-8", seniority: "Senior" },
  { years: [8, 10], bucket: "8-12", seniority: "Lead" },
]);

const BRANCHES = Object.freeze([
  "CSE",
  "ECE",
  "EEE",
  "Mechanical",
  "Civil",
  "Chemical",
]);

const SKILL_BUNDLES = Object.freeze([
  {
    required: ["JavaScript", "React", "Node.js"],
    requiredIds: ["javascript", "react", "node-js"],
    preferred: ["TypeScript", "MongoDB"],
    preferredIds: ["typescript", "mongodb"],
  },
  {
    required: ["Java", "Spring Boot", "SQL"],
    requiredIds: ["java", "spring-boot", "sql"],
    preferred: ["AWS", "Redis"],
    preferredIds: ["aws", "redis"],
  },
  {
    required: ["Python", "FastAPI", "PostgreSQL"],
    requiredIds: ["python", "fastapi", "postgresql"],
    preferred: ["Docker", "Kubernetes"],
    preferredIds: ["docker", "kubernetes"],
  },
  {
    required: ["Go", "Kafka", "MongoDB"],
    requiredIds: ["go", "kafka", "mongodb"],
    preferred: ["GCP", "Terraform"],
    preferredIds: ["gcp", "terraform"],
  },
]);

const COMPANY_NAMES = Object.freeze(
  Array.from({ length: 1299 }, (_, index) => `Company ${String(index + 1).padStart(4, "0")}`),
);

const CANONICAL_MATCH_COMPANY = "Google";
const CANONICAL_MATCH_CITY = "Bangalore";

const buildJobSkills = (bundle) => {
  const requiredSkills = bundle.required.map((label, index) => ({
    skillId: bundle.requiredIds[index],
    canonicalName: label,
    category: "Core",
    required: true,
    preferred: false,
    confidence: "high",
    extractionSource: "fixture",
    matchedPhrase: label,
  }));
  const preferredSkills = bundle.preferred.map((label, index) => ({
    skillId: bundle.preferredIds[index],
    canonicalName: label,
    category: "Supporting",
    required: false,
    preferred: true,
    confidence: "medium",
    extractionSource: "fixture",
    matchedPhrase: label,
  }));

  return [...requiredSkills, ...preferredSkills];
};

const buildBaseJob = ({
  index,
  company,
  city,
  state,
  country = "India",
  title,
  description,
  jobType,
  primaryRoleDomain,
  workArrangement,
  seniority,
  experienceYears,
  experienceBucket,
  skillBundle,
  postedAt,
  status = "active",
  clickCount = 0,
}) => {
  const safePostedAt = new Date(postedAt);
  const location = workArrangement === "Remote"
    ? "India Offsite"
    : `${city}, ${country}`;
  const requiredSkills = skillBundle.required;
  const skillIds = [...skillBundle.requiredIds, ...skillBundle.preferredIds];
  const jobSkills = buildJobSkills(skillBundle);
  const base = {
    title,
    originalTitle: title,
    normalizedTitle: title.toLowerCase(),
    company,
    jobCategory: primaryRoleDomain,
    engineeringDomain: primaryRoleDomain,
    employmentType: jobType === "Contract" ? "Contract" : jobType === "Internship" ? "Internship" : "Full-time",
    experienceLevel: seniority,
    jobType,
    location,
    city,
    state,
    country,
    remoteStatus: workArrangement === "Remote" ? "remote" : workArrangement === "Hybrid" ? "hybrid" : "on-site",
    locations: [location],
    department: primaryRoleDomain,
    eligibleBatches: [2025 + (index % 4), 2027],
    branches: [BRANCHES[index % BRANCHES.length], "CSE"],
    requiredSkills,
    source: "fixture-seed",
    sourceUrl: `https://example.com/jobs/${index + 1}`,
    applyUrl: `https://example.com/jobs/${index + 1}/apply`,
    companyCareerPage: "https://example.com/careers",
    atsPlatform: "fixture",
    description,
    minimumQualification: "Bachelor degree in engineering or related discipline.",
    preferredQualification: "Prior internships or project experience preferred.",
    experienceRequired: `${Math.min(...experienceYears)}-${Math.max(...experienceYears)} years`,
    salary: "Competitive",
    skillIds,
    requiredSkillIds: [...skillBundle.requiredIds],
    preferredSkillIds: [...skillBundle.preferredIds],
    jobSkills,
    experienceBucket,
    experienceYears,
    experienceProfile: {
      rawText: `${Math.min(...experienceYears)}-${Math.max(...experienceYears)} years`,
      minimumYears: Math.min(...experienceYears),
      maximumYears: Math.max(...experienceYears),
      isOpenEnded: false,
      preferredMinimumYears: Math.min(...experienceYears),
      hasExplicitExperience: true,
      confidence: "high",
      evidence: "fixture",
    },
    seniority,
    primaryRoleDomain,
    secondaryRoleDomains: primaryRoleDomain === "Software Engineering"
      ? ["Frontend Engineering", "Backend Engineering"]
      : [ROLE_DOMAIN_OPTIONS[(index + 3) % ROLE_DOMAIN_OPTIONS.length]],
    workArrangement,
    filterSignals: {
      confidence: {
        experience: "high",
        seniority: "high",
        roleDomain: "high",
        workArrangement: "high",
      },
    },
    taxonomyVersion: TAXONOMY_VERSION,
    extractionVersion: EXTRACTION_VERSION,
    extractedAt: safePostedAt,
    jobId: `fixture-job-${index + 1}`,
    requisitionId: `REQ-${String(index + 1).padStart(5, "0")}`,
    fingerprint: `fixture-job-${index + 1}`,
    postedAt: safePostedAt,
    sortDate: safePostedAt,
    scrapedAt: safePostedAt,
    scrapedTimestamp: safePostedAt,
    lastSeenAt: safePostedAt,
    missedScrapeCount: 0,
    status,
    clickCount,
    createdAt: safePostedAt,
    updatedAt: safePostedAt,
  };

  return {
    ...base,
    ...buildJobSearchKeys(base),
    ...buildJobDerivedFields(base),
  };
};

const buildCanonicalMatchJob = () => buildBaseJob({
  index: 0,
  company: CANONICAL_MATCH_COMPANY,
  city: CANONICAL_MATCH_CITY,
  state: "Karnataka",
  title: "Frontend Developer Intern",
  description: "Developer internship building React interfaces and Node.js APIs for job search.",
  jobType: "Internship",
  primaryRoleDomain: "Software Engineering",
  workArrangement: "Remote",
  seniority: "Internship",
  experienceYears: [3],
  experienceBucket: "1-3",
  skillBundle: SKILL_BUNDLES[0],
  postedAt: new Date("2026-07-18T08:00:00.000Z"),
  clickCount: 220,
});

const buildGeneratedJob = (index) => {
  const fixtureIndex = index - 1;

  if (fixtureIndex >= ACTIVE_JOB_COUNT && fixtureIndex < ACTIVE_JOB_COUNT + NON_PUBLIC_ACTIVE_JOB_COUNT) {
    const location = NON_PUBLIC_LOCATIONS[fixtureIndex % NON_PUBLIC_LOCATIONS.length];
    const profile = EXPERIENCE_PROFILES[fixtureIndex % EXPERIENCE_PROFILES.length];
    const roleDomain = ROLE_DOMAINS[fixtureIndex % ROLE_DOMAINS.length];
    const jobType = JOB_TYPES[fixtureIndex % JOB_TYPES.length];
    const workArrangement = WORK_ARRANGEMENTS[fixtureIndex % WORK_ARRANGEMENTS.length];

    return buildBaseJob({
      index,
      company: COMPANY_NAMES[fixtureIndex % COMPANY_NAMES.length],
      city: location.city,
      state: location.state,
      country: location.country,
      title: `${roleDomain} Developer ${index}`,
      description: `Developer role outside the public India scope for ${roleDomain}.`,
      jobType,
      primaryRoleDomain: roleDomain,
      workArrangement,
      seniority: profile.seniority,
      experienceYears: profile.years,
      experienceBucket: profile.bucket,
      skillBundle: SKILL_BUNDLES[fixtureIndex % SKILL_BUNDLES.length],
      postedAt: new Date(Date.UTC(2026, 5, (fixtureIndex % 27) + 1, 6, 0, 0)),
      status: "active",
      clickCount: 40 + (fixtureIndex % 180),
    });
  }

  if (fixtureIndex >= ACTIVE_JOB_COUNT + NON_PUBLIC_ACTIVE_JOB_COUNT
    && fixtureIndex < ACTIVE_JOB_COUNT + NON_PUBLIC_ACTIVE_JOB_COUNT + EXPIRED_JOB_COUNT) {
    const cityEntry = INDIA_CITIES[fixtureIndex % INDIA_CITIES.length];
    const profile = EXPERIENCE_PROFILES[fixtureIndex % EXPERIENCE_PROFILES.length];
    return buildBaseJob({
      index,
      company: COMPANY_NAMES[fixtureIndex % COMPANY_NAMES.length],
      city: cityEntry.city,
      state: cityEntry.state,
      title: `Expired Developer Role ${index}`,
      description: "Expired developer listing kept for status coverage.",
      jobType: "Full-time Experienced",
      primaryRoleDomain: "Software Engineering",
      workArrangement: "Hybrid",
      seniority: profile.seniority,
      experienceYears: profile.years,
      experienceBucket: profile.bucket,
      skillBundle: SKILL_BUNDLES[fixtureIndex % SKILL_BUNDLES.length],
      postedAt: new Date(Date.UTC(2026, 2, (fixtureIndex % 27) + 1, 6, 0, 0)),
      status: "expired",
      clickCount: 10 + (fixtureIndex % 60),
    });
  }

  if (fixtureIndex >= ACTIVE_JOB_COUNT + NON_PUBLIC_ACTIVE_JOB_COUNT + EXPIRED_JOB_COUNT) {
    const cityEntry = INDIA_CITIES[fixtureIndex % INDIA_CITIES.length];
    const profile = EXPERIENCE_PROFILES[fixtureIndex % EXPERIENCE_PROFILES.length];
    return buildBaseJob({
      index,
      company: COMPANY_NAMES[fixtureIndex % COMPANY_NAMES.length],
      city: cityEntry.city,
      state: cityEntry.state,
      title: `Hidden Platform Role ${index}`,
      description: "Hidden role reserved for status coverage.",
      jobType: "Contract",
      primaryRoleDomain: "DevOps & SRE",
      workArrangement: "On-site",
      seniority: profile.seniority,
      experienceYears: profile.years,
      experienceBucket: profile.bucket,
      skillBundle: SKILL_BUNDLES[fixtureIndex % SKILL_BUNDLES.length],
      postedAt: new Date(Date.UTC(2026, 1, (fixtureIndex % 27) + 1, 6, 0, 0)),
      status: "hidden",
      clickCount: 5 + (fixtureIndex % 40),
    });
  }

  const cityEntry = INDIA_CITIES[fixtureIndex % INDIA_CITIES.length];
  const profile = EXPERIENCE_PROFILES[fixtureIndex % EXPERIENCE_PROFILES.length];
  const roleDomain = ROLE_DOMAINS[fixtureIndex % ROLE_DOMAINS.length];
  const jobType = JOB_TYPES[fixtureIndex % JOB_TYPES.length];
  const workArrangement = WORK_ARRANGEMENTS[fixtureIndex % WORK_ARRANGEMENTS.length];
  const company = fixtureIndex % 15 === 0
    ? CANONICAL_MATCH_COMPANY
    : COMPANY_NAMES[fixtureIndex % COMPANY_NAMES.length];
  const titlePrefix = fixtureIndex % 3 === 0
    ? "Developer"
    : fixtureIndex % 3 === 1
      ? "Engineer"
      : "Analyst";
  const title = `${roleDomain} ${titlePrefix} ${index}`;
  const description = [
    `${titlePrefix} opening for ${company} in ${cityEntry.city}.`,
    `Work with ${SKILL_BUNDLES[fixtureIndex % SKILL_BUNDLES.length].required.join(", ")}.`,
    fixtureIndex % 5 === 0 ? "Developer growth path for early-career engineers." : "Build production-grade systems.",
  ].join(" ");

  return buildBaseJob({
    index,
    company,
    city: fixtureIndex % 17 === 0 ? CANONICAL_MATCH_CITY : cityEntry.city,
    state: cityEntry.state,
    title,
    description,
    jobType,
    primaryRoleDomain: roleDomain,
    workArrangement,
    seniority: profile.seniority,
    experienceYears: profile.years,
    experienceBucket: profile.bucket,
    skillBundle: SKILL_BUNDLES[fixtureIndex % SKILL_BUNDLES.length],
    postedAt: new Date(Date.UTC(2026, 6, (fixtureIndex % 22) + 1, 8, fixtureIndex % 60, 0)),
    clickCount: 20 + (fixtureIndex % 260),
  });
};

// Profiling keeps its fixed dates; local browser stacks can opt into a valid Date clock.
export const buildJobProfileFixtureJobs = ({ totalJobs = DEFAULT_TOTAL_JOBS, referenceDate } = {}) => {
  if (referenceDate !== undefined && (!(referenceDate instanceof Date) || !Number.isFinite(referenceDate.getTime()))) {
    throw new TypeError("referenceDate must be a valid Date.");
  }
  const safeTotalJobs = Math.max(totalJobs, DEFAULT_TOTAL_JOBS);
  const jobs = [buildCanonicalMatchJob()];

  for (let index = 1; index < safeTotalJobs; index += 1) {
    jobs.push(buildGeneratedJob(index));
  }

  if (referenceDate === undefined) return jobs;
  const newestPostedAt = jobs.reduce((latest, job) => Math.max(latest, job.postedAt.getTime()), -Infinity);
  const shift = referenceDate.getTime() - newestPostedAt;
  return jobs.map(job => ({
    ...job,
    ...Object.fromEntries(FIXTURE_TIMESTAMP_FIELDS.map(field => {
      const shifted = new Date(job[field].getTime() + shift);
      if (!Number.isFinite(shifted.getTime())) throw new RangeError("referenceDate produces out-of-range fixture timestamps.");
      return [field, shifted];
    })),
  }));
};

export const seedJobProfileFixtures = async (JobModel, options = {}) => {
  const jobs = buildJobProfileFixtureJobs(options);
  await JobModel.insertMany(jobs, { ordered: true });

  return {
    totalJobs: jobs.length,
    canonicalMatch: {
      company: CANONICAL_MATCH_COMPANY,
      city: CANONICAL_MATCH_CITY,
      title: jobs[0].title,
      postedAt: jobs[0].postedAt.toISOString(),
    },
  };
};
