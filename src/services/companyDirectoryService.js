import Job from "../models/Job.js";
import { applyPublicJobVisibility } from "../utils/publicJobVisibility.js";
import { normalizePublicWorkArrangement, PUBLIC_WORK_ARRANGEMENT_EXPRESSION } from '../utils/publicWorkArrangement.js';

export const DEFAULT_COMPANY_PAGE_SIZE = 24;
export const MAX_COMPANY_PAGE_SIZE = 48;
export const RECENT_COMPANY_JOB_LIMIT = 6;
const MAX_SEARCH_LENGTH = 100;

const RECENT_JOB_FIELDS = [
  "_id",
  "title",
  "company",
  "city",
  "locations",
  "jobType",
  "primaryRoleDomain",
  "workArrangement",
  "remoteStatus",
  "sourceRemoteStatusUnresolved",
  "postedAt",
  "sortDate",
].join(" ");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const positiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

const cleanString = (value) => {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned || null;
};

const cleanStringList = (values) => {
  const entries = Array.isArray(values) ? values : [];
  const unique = new Map();

  entries.forEach((value) => {
    const cleaned = cleanString(value);
    if (!cleaned) return;
    const key = cleaned.toLocaleLowerCase("en");
    if (!unique.has(key)) unique.set(key, cleaned);
  });

  return [...unique.values()].sort((left, right) => (
    left.localeCompare(right, "en", { sensitivity: "base" })
  ));
};

const buildPublicCompanyMatch = ({ companyKey, query, siteSettings = {} } = {}) => {
  const identityFilter = companyKey
    ? { companyKey }
    : { companyKey: { $type: "string", $regex: /\S/ } };
  const match = applyPublicJobVisibility({
    status: "active",
    ...identityFilter,
  }, siteSettings);

  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    match.$or = [
      { company: pattern },
      { companyKey: pattern },
      { companyDomain: pattern },
    ];
  }

  return match;
};

const companyGroupStages = () => [
  {
    $set: {
      companyDirectoryName: {
        $let: {
          vars: {
            trimmedName: { $trim: { input: { $ifNull: ["$company", ""] } } },
          },
          in: {
            $cond: [
              { $ne: ["$$trimmedName", ""] },
              "$$trimmedName",
              "$companyKey",
            ],
          },
        },
      },
      companyDirectoryLocations: {
        $setUnion: [
          { $cond: [{ $isArray: "$locations" }, "$locations", []] },
          [{ $ifNull: ["$city", "$location"] }],
        ],
      },
    },
  },
  {
    $group: {
      _id: "$companyKey",
      name: { $min: "$companyDirectoryName" },
      domains: { $addToSet: "$companyDomain" },
      careerPages: { $addToSet: "$companyCareerPage" },
      atsPlatforms: { $addToSet: "$atsPlatform" },
      activeJobCount: { $sum: 1 },
      locationSets: { $addToSet: "$companyDirectoryLocations" },
      jobTypes: { $addToSet: "$jobType" },
      roleDomains: { $addToSet: "$primaryRoleDomain" },
      workArrangements: { $addToSet: { $cond: [
        { $eq: ['$sourceRemoteStatusUnresolved', true] }, PUBLIC_WORK_ARRANGEMENT_EXPRESSION, '$workArrangement',
      ] } },
      latestPostedAt: { $max: { $ifNull: ["$postedAt", "$sortDate"] } },
    },
  },
  {
    $project: {
      _id: 0,
      key: "$_id",
      name: 1,
      domains: 1,
      careerPages: 1,
      atsPlatforms: 1,
      activeJobCount: 1,
      locations: {
        $reduce: {
          input: "$locationSets",
          initialValue: [],
          in: { $setUnion: ["$$value", "$$this"] },
        },
      },
      jobTypes: 1,
      roleDomains: 1,
      workArrangements: 1,
      latestPostedAt: 1,
      sortName: { $toLower: "$name" },
    },
  },
];

const normalizeCompany = (company, { includeDetails = false } = {}) => {
  const domains = cleanStringList(company?.domains);
  const careerPages = cleanStringList(company?.careerPages);
  const normalized = {
    key: cleanString(company?.key),
    name: cleanString(company?.name) || cleanString(company?.key),
    domain: domains[0] || null,
    careerPage: careerPages[0] || null,
    atsPlatforms: cleanStringList(company?.atsPlatforms),
    activeJobCount: Math.max(0, Number(company?.activeJobCount) || 0),
    locations: cleanStringList(company?.locations),
    latestPostedAt: company?.latestPostedAt ?? null,
  };

  if (includeDetails) {
    normalized.jobTypes = cleanStringList(company?.jobTypes);
    normalized.roleDomains = cleanStringList(company?.roleDomains);
    normalized.workArrangements = cleanStringList(company?.workArrangements);
  }

  return normalized;
};

const normalizeRecentJob = (job) => ({
  id: String(job?._id),
  title: cleanString(job?.title),
  company: cleanString(job?.company),
  city: cleanString(job?.city),
  locations: cleanStringList(job?.locations),
  jobType: cleanString(job?.jobType),
  roleDomain: cleanString(job?.primaryRoleDomain),
  workArrangement: job?.sourceRemoteStatusUnresolved === true
    ? normalizePublicWorkArrangement(job.workArrangement, job) : cleanString(job?.workArrangement),
  postedAt: job?.postedAt ?? job?.sortDate ?? null,
});

export async function listPublicCompanies({
  query = "",
  page = 1,
  limit = DEFAULT_COMPANY_PAGE_SIZE,
  siteSettings = {},
} = {}) {
  const normalizedQuery = String(query ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const normalizedPage = positiveInteger(page, 1, Number.MAX_SAFE_INTEGER);
  const normalizedLimit = positiveInteger(
    limit,
    DEFAULT_COMPANY_PAGE_SIZE,
    MAX_COMPANY_PAGE_SIZE,
  );
  const skip = (normalizedPage - 1) * normalizedLimit;
  const pipeline = [
    { $match: buildPublicCompanyMatch({ query: normalizedQuery, siteSettings }) },
    ...companyGroupStages(),
    {
      $facet: {
        companies: [
          { $sort: { sortName: 1, key: 1 } },
          { $skip: skip },
          { $limit: normalizedLimit },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result = {}] = await Job.aggregate(pipeline, { maxTimeMS: 5000 }).exec();
  const total = Math.max(0, Number(result.total?.[0]?.count) || 0);

  return {
    companies: (result.companies || []).map((company) => normalizeCompany(company)),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / normalizedLimit),
    },
    query: normalizedQuery,
  };
}

export async function getPublicCompanyByKey({ companyKey, siteSettings = {} } = {}) {
  const normalizedKey = String(companyKey ?? "").trim();
  if (!normalizedKey) return null;

  const match = buildPublicCompanyMatch({ companyKey: normalizedKey, siteSettings });
  const companies = await Job.aggregate([
    { $match: match },
    ...companyGroupStages(),
    { $limit: 1 },
  ], { maxTimeMS: 5000 }).exec();

  if (!companies[0]) return null;

  const jobs = await Job.find(match, null, { maxTimeMS: 5000 })
    .select(RECENT_JOB_FIELDS)
    .sort({ sortDate: -1, _id: -1 })
    .limit(RECENT_COMPANY_JOB_LIMIT)
    .lean()
    .exec();

  return {
    company: normalizeCompany(companies[0], { includeDetails: true }),
    recentJobs: jobs.slice(0, RECENT_COMPANY_JOB_LIMIT).map(normalizeRecentJob),
  };
}
