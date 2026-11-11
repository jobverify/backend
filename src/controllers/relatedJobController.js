import Job from '../models/Job.js';
import { normalizeJobListResponseJob } from './jobController.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../utils/publicJobType.js';
import { safeSourceUrl } from '../utils/jobProvenance.js';

const RESULT_LIMIT = 3;
const CANDIDATE_LIMIT = 12;
const QUERY_TIMEOUT_MS = 1500;
const CARD_FIELDS = 'title company companyKey city location locations jobType employmentType experienceLevel experienceRequired classification primaryRoleDomain skillIds workArrangement remoteStatus sourceRemoteStatusUnresolved salary postedAt closingDate status applyUrl sourceUrl workdayApplicationStatus workdayApplicationStatusReason workdayApplicationStatusCheckedAt';

// Compact projections omit the source text used by the public taxonomy. Retain
// Mongo's effective category instead of inferring it again from partial fields.
const normalizeRelatedCard = row => {
  const { _publicJobType, ...card } = normalizeJobListResponseJob(row);
  return { ...card, jobType: row._publicJobType };
};

// Criteria come from a public seed listing, never user-selected search filters.
export async function getRelatedJobs(req, res, next) {
  try {
    const now = new Date();
    const publicFilter = extra => applyPublicJobVisibility({ status: 'active',
      workdayApplicationStatus: { $nin: ['unavailable', 'temporarily_unavailable'] },
      ...extra }, req.siteSettings, now);
    res.set('Cache-Control', 'no-store');
    const seed = await Job.findOne(publicFilter({ _id: req.params.id }))
      .select(CARD_FIELDS).select({ _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION })
        .maxTimeMS(QUERY_TIMEOUT_MS).lean().exec();
    const normalizedSeed = seed && normalizeRelatedCard(seed);
    if (!normalizedSeed || normalizedSeed.applicationStatus !== 'available'
      || !safeSourceUrl(normalizedSeed.applicationUrl)) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }
    const company = seed.companyKey ? { companyKey: seed.companyKey } : { company: seed.company };
    const skillIds = (Array.isArray(seed.skillIds) ? seed.skillIds : [])
      .filter(value => typeof value === 'string' && value.trim()).slice(0, 8);
    const matches = [];
    if (seed.primaryRoleDomain && !/^(other|unspecified)$/i.test(seed.primaryRoleDomain)) {
      matches.push({ primaryRoleDomain: seed.primaryRoleDomain });
    }
    if (skillIds.length) matches.push({ skillIds: { $in: skillIds } });
    const readCards = async criteria => {
      const rows = await Job.find(publicFilter({ _id: { $ne: seed._id }, ...criteria }))
        .sort({ sortDate: -1, _id: -1 }).limit(CANDIDATE_LIMIT)
        .select(CARD_FIELDS).select({ _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION })
        .maxTimeMS(QUERY_TIMEOUT_MS).lean().exec();
      return rows.map(normalizeRelatedCard)
        .filter(row => row.applicationStatus === 'available' && safeSourceUrl(row.applicationUrl))
        .slice(0, RESULT_LIMIT)
        .map(({ skillIds: _skillIds, ...card }) => card);
    };
    const [sameCompany, similar] = await Promise.all([
      seed.company ? readCards(company) : [],
      matches.length ? readCards({ $and: [
        { $nor: [company] }, { $or: matches },
        { $expr: { $eq: [PUBLIC_JOB_TYPE_EXPRESSION, normalizedSeed.jobType] } },
      ] }) : [],
    ]);
    return res.json({ success: true, data: { jobId: String(seed._id), sameCompany, similar } });
  } catch (error) { return next(error); }
}
