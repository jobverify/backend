import Job from '../models/Job.js';
import { getSiteSettings } from '../services/siteSettingsService.js';
import { readHiringSnapshot, observationScope } from '../services/hiringObservationService.js';
import { normalizeJobListResponseJob, slugifyJob } from './jobController.js';
import { applyPublicJobVisibility } from '../utils/publicJobVisibility.js';
import { PUBLIC_JOB_TYPE_EXPRESSION } from '../utils/publicJobType.js';
import { safeSourceUrl } from '../utils/jobProvenance.js';

const wrap = handler => async (req, res, next) => { try { await handler(req, res); } catch (error) { next(error); } };
export const getPublishingBuildFeed = wrap(async (req, res) => {
  const cursor = req.query.cursor;
  if (cursor && !/^[a-f0-9]{24}$/i.test(cursor)) return res.status(400).json({ success: false, message: 'Invalid cursor' });
  const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 200));
  const settings = await getSiteSettings();
  const rows = await Job.find(applyPublicJobVisibility({
    status: 'active', sourceUrl: { $exists: true, $ne: null }, description: { $type: 'string', $ne: '' },
    ...(cursor ? { _id: { $gt: cursor } } : {}), $or: [{ closingDate: null }, { closingDate: { $gt: new Date() } }],
  }, settings)).sort({ _id: 1 }).limit(limit + 1)
    .select('title company description descriptionFormat sourceUrl applyUrl applicationUrl applicationStatus applicationStatusReason workdayApplicationStatus workdayApplicationStatusReason workdayApplicationStatusCheckedAt city location locations country jobType employmentType experienceLevel experienceRequired sourceExperienceRequired sourceEmploymentType classification minimumQualification preferredQualification salary employerPostedAt postedAt postedAtProvenance postedAtProvenanceValue closingDate updatedAt lastSeenAt scrapedAt requisitionId requiredSkills eligibleBatches eligibleBatchesProvenance branches')
    .select({ _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION }).lean().exec();
  const data = rows.slice(0, limit).map(row => {
    const job = normalizeJobListResponseJob(row);
    return { ...job, id: String(row._id), path: `/jobs/${row._id}/${slugifyJob(row.title, row.company)}`, lastModified: row.updatedAt || row.postedAt || null, validThrough: row.closingDate || null };
  }).filter(job => job.applicationStatus === 'available' && safeSourceUrl(job.sourceUrl) && job.description.trim().length >= 120);
  res.set('Cache-Control', 'no-store').json({ success: true, data: {
    jobs: data, scope: observationScope(settings), nextCursor: rows.length > limit ? String(rows[limit - 1]._id) : null,
    ...(cursor ? {} : { summary: await readHiringSnapshot(settings), settings }),
  } });
});
