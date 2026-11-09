import Job from '../models/Job.js';
import HiringObservation from '../models/HiringObservation.js';
import ScraperStatus from '../models/ScraperStatus.js';
import { getSiteSettings } from './siteSettingsService.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../utils/publicJobType.js';
import { PUBLIC_WORK_ARRANGEMENT_EXPRESSION } from '../utils/publicWorkArrangement.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';

export const OBSERVATION_VERSION = 3;
export const observationScope = settings => `india-v${OBSERVATION_VERSION}-${settings?.experiencedJobsEnabled === false ? 'early-career' : 'all-types'}`;
export const indiaDay = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const label = field => ({ $trim: { input: { $ifNull: [field === 'jobType' ? PUBLIC_JOB_TYPE_EXPRESSION
  : field === 'workArrangement' ? PUBLIC_WORK_ARRANGEMENT_EXPRESSION : '$' + field, ''] } } });
const ranking = field => [
  { $group: { _id: { $toLower: label(field) }, label: { $first: label(field) }, count: { $sum: 1 } } },
  { $sort: { count: -1, label: 1 } },
  { $limit: 10 },
  { $project: { _id: 0, label: { $cond: [{ $eq: ['$label', ''] }, 'Not specified', '$label'] }, count: 1 } },
];
const recordedSkills = [{ $project: { names: { $filter: {
  input: { $map: { input: { $ifNull: ['$jobSkills', []] }, as: 'skill', in: { $trim: { input: { $ifNull: ['$$skill.canonicalName', ''] } } } } },
  as: 'name', cond: { $ne: ['$$name', ''] },
} } } }];
export async function readHiringSnapshot(settings = {}, now = new Date()) {
  const dayMs = 86400000;
  const firstDay = new Date(`${indiaDay(now)}T00:00:00+05:30`).getTime() - 89 * dayMs;
  const [result] = await Job.aggregate([
    { $match: applyPublicJobVisibility({ status: 'active', $or: [{ closingDate: null }, { closingDate: { $gt: now } }] }, settings, now) },
    { $facet: {
      totals: [{ $count: 'count' }],
      companyTotals: [{ $group: { _id: { $toLower: label('company') } } }, { $match: { _id: { $ne: '' } } }, { $count: 'count' }],
      companies: ranking('company'), locations: ranking('city'), jobTypes: ranking('jobType'),
      roles: ranking('primaryRoleDomain'), arrangements: ranking('workArrangement'),
      skillCoverage: [...recordedSkills, { $match: { 'names.0': { $exists: true } } }, { $count: 'count' }],
      skills: [
        ...recordedSkills,
        { $unwind: '$names' },
        // Count each canonical skill at most once per job, including case variants.
        { $group: { _id: { job: '$_id', name: { $toLower: '$names' } }, label: { $first: '$names' } } },
        { $group: { _id: '$_id.name', label: { $first: '$label' }, count: { $sum: 1 } } },
        { $sort: { count: -1, label: 1 } }, { $limit: 12 },
        { $project: { _id: 0, label: 1, count: 1 } },
      ],
      daily: [
        { $match: { postedAt: { $type: 'date', $gte: new Date(firstDay), $lte: now } } },
        { $project: { postedAt: 1, entryLevel: { $regexMatch: { input: label('jobType'), regex: 'fresher|intern|apprentice', options: 'i' } } } },
        { $group: {
          _id: { $dateToString: { date: '$postedAt', format: '%Y-%m-%d', timezone: 'Asia/Kolkata' } },
          count: { $sum: 1 }, entryLevel: { $sum: { $cond: ['$entryLevel', 1, 0] } },
        } },
      ],
    } },
  ], { maxTimeMS: 5000 }).exec();
  const dailyCounts = new Map((result?.daily ?? []).map(row => [row._id, row]));
  return {
    generatedAt: now.toISOString(), scope: observationScope(settings),
    totalJobs: result?.totals?.[0]?.count ?? 0, totalCompanies: result?.companyTotals?.[0]?.count ?? 0,
    companies: result?.companies ?? [], locations: result?.locations ?? [], jobTypes: result?.jobTypes ?? [],
    roles: result?.roles ?? [], arrangements: result?.arrangements ?? [], skills: result?.skills ?? [],
    skillCoverage: result?.skillCoverage?.[0]?.count ?? 0,
    daily: Array.from({ length: 90 }, (_, index) => {
      const date = indiaDay(new Date(firstDay + index * dayMs));
      const row = dailyCounts.get(date);
      return { date, count: row?.count ?? 0, entryLevel: row?.entryLevel ?? 0 };
    }),
  };
}
export function compareObservations(current, previous) {
  const currentTime = new Date(current?.generatedAt).getTime();
  const previousTime = new Date(previous?.generatedAt).getTime();
  if (!current || !previous || !current.scope || current.scope !== previous.scope || !Number.isFinite(currentTime) || !Number.isFinite(previousTime) || previousTime >= currentTime) return null;
  return { previousAt: previous.generatedAt, jobsChange: current.totalJobs - previous.totalJobs, companiesChange: current.totalCompanies - previous.totalCompanies };
}
export async function captureHiringObservation() {
  const settings = await getSiteSettings();
  const now = new Date();
  const key = `${indiaDay(now)}:${observationScope(settings)}`;
  const existing = await HiringObservation.findOne({ key }).lean();
  if (existing) return existing;
  const running = await ScraperStatus.exists({ source: '__pipeline__', pipelineState: 'running' });
  if (running) return null;
  const snapshot = await readHiringSnapshot(settings, now);
  // No placeholder or empty observation becomes a historical hiring record.
  if (!snapshot.totalJobs) return null;
  const coverage = await ScraperStatus.aggregate([
    { $match: { isActive: true, source: { $ne: '__pipeline__' } } },
    { $group: { _id: null, trackedSources: { $sum: 1 }, successfulLastChecks: { $sum: { $cond: [{ $and: ['$lastSuccess', { $ne: ['$softFailure', true] }, { $ne: ['$upstreamOutage', true] }] }, 1, 0] } }, partialLastChecks: { $sum: { $cond: [{ $and: [{ $ne: ['$lastPartialAt', null] }, { $gte: ['$lastPartialAt', '$lastRanAt'] }] }, 1, 0] } } } },
    { $project: { _id: 0 } },
  ]).exec();
  try {
    // The deterministic _id has MongoDB's built-in uniqueness even before the
    // optional key index is installed; concurrent capture cannot create two days.
    return (await HiringObservation.create({ _id: key, key, ...snapshot, coverage: coverage[0] || { trackedSources: 0, successfulLastChecks: 0, partialLastChecks: 0 } })).toObject();
  } catch (error) {
    if (error.code === 11000) return HiringObservation.findOne({ key }).lean();
    throw error;
  }
}
