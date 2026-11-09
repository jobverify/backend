import mongoose from 'mongoose';
import Application, { APPLICATION_STAGES } from '../models/Application.js';
import TailoredResume from '../models/TailoredResume.js';
import Job from '../models/Job.js';
import { safeApplicationUrl, recordApplicationEvidence, publicApplication } from '../services/applicationService.js';
import { respondWithInternalError } from '../utils/respondWithInternalError.js';

const PAGE_SIZE = 2;

export async function getApplications(req, res) {
  const { page: rawPage = '1', status = 'all', stage = 'all' } = req.query ?? {};
  const page = Number(rawPage);
  if (typeof rawPage !== 'string' || !/^\d+$/.test(rawPage) || !Number.isSafeInteger(page) || page < 1 || page > 100000
    || !['all', 'opened', 'applied'].includes(status) || !['all', ...APPLICATION_STAGES].includes(stage)) {
    return res.status(400).json({ success: false, message: 'Invalid application page or status.' });
  }
  try {
    const filters = [...(status === 'all' ? [] : [{ $match: { status } }]), ...(stage === 'all' ? [] : [{ $match: { stage } }])];
    // A tailored resume request is the only way a job enters this tracker.
    // Employer-page clicks and submission evidence alone do not add entries.
    const [result] = await TailoredResume.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)) } },
      { $lookup: { from: Application.collection.name, let: { owner: '$user', jobId: '$job' }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$user', '$$owner'] }, { $eq: ['$job', '$$jobId'] }] } } },
      ], as: 'application' } },
      { $lookup: { from: Job.collection.name, localField: 'job', foreignField: '_id', pipeline: [
        { $project: { title: 1, company: 1, location: 1, city: 1, jobType: 1, applicationUrl: 1, applyUrl: 1, sourceUrl: 1 } },
      ], as: 'listing' } },
      { $set: { application: { $first: '$application' }, listing: { $first: '$listing' } } },
      { $match: { $or: [{ 'application._id': { $exists: true } }, { 'listing._id': { $exists: true } }] } },
      { $project: {
        _id: { $ifNull: ['$application._id', { $concat: ['resume:', { $toString: '$job' }] }] },
        job: 1, status: { $ifNull: ['$application.status', 'opened'] },
        stage: { $ifNull: ['$application.stage', { $cond: [{ $eq: ['$application.status', 'applied'] }, 'applied', 'preparing'] }] },
        version: { $ifNull: ['$application.version', 0] },
        canConfirm: { $ne: [{ $ifNull: ['$application._id', null] }, null] },
        firstOpenedAt: { $ifNull: ['$application.firstOpenedAt', null] },
        appliedAt: { $ifNull: ['$application.appliedAt', null] },
        confirmationSource: { $ifNull: ['$application.confirmationSource', ''] },
        evidence: { $ifNull: ['$application.evidence', []] },
        resumeStatus: '$status', resumeRequestedAt: { $ifNull: ['$requestedAt', '$createdAt'] },
        trackedAt: { $ifNull: ['$requestedAt', '$createdAt'] },
        jobSnapshot: { $ifNull: ['$application.jobSnapshot', {
          title: '$listing.title', company: '$listing.company',
          location: { $ifNull: ['$listing.location', '$listing.city'] }, jobType: '$listing.jobType',
          applicationUrl: '$listing.applicationUrl', applyUrl: '$listing.applyUrl', sourceUrl: '$listing.sourceUrl',
        }] },
      } },
      { $facet: {
        items: [
          ...filters,
          { $sort: { trackedAt: -1, _id: -1 } }, { $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE },
        ],
        counts: [{ $group: { _id: null, total: { $sum: 1 }, applied: { $sum: { $cond: [{ $eq: ['$status', 'applied'] }, 1, 0] } } } }],
        stageCounts: [{ $group: { _id: '$stage', total: { $sum: 1 } } }],
        filteredCounts: [...filters, { $count: 'total' }],
      } },
    ]);
    const { total = 0, applied = 0 } = result.counts[0] ?? {};
    const items = result.items.map(item => ({ ...item, jobSnapshot: {
      title: item.jobSnapshot.title, company: item.jobSnapshot.company,
      location: item.jobSnapshot.location || '', jobType: item.jobSnapshot.jobType || '',
      applicationUrl: safeApplicationUrl(item.jobSnapshot),
    } }));
    const summary = { total, opened: total - applied, applied };
    const filteredTotal = result.filteredCounts[0]?.total ?? 0;
    const stageSummary = Object.fromEntries(APPLICATION_STAGES.map(name => [name, result.stageCounts?.find(row => row._id === name)?.total || 0]));
    return res.status(200).json({
      success: true, data: items, summary, stageSummary,
      pagination: { page, limit: PAGE_SIZE, total: filteredTotal, totalPages: Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE)) },
    });
  } catch (error) {
    return respondWithInternalError(res, error, { message: 'Could not load your applications.' });
  }
}

export async function markApplicationApplied(req, res) {
  const { applicationId } = req.params;
  if (!mongoose.isObjectIdOrHexString(applicationId)) {
    return res.status(400).json({ success: false, message: 'Invalid application ID.' });
  }
  try {
    const application = await recordApplicationEvidence(req.user._id, applicationId, {
      key: 'manual', source: 'self_reported', observedAt: new Date(), summary: 'Candidate confirmed submission on the employer website.',
    });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    return res.status(200).json({ success: true, data: application });
  } catch (error) {
    return respondWithInternalError(res, error, { message: 'Could not save your application status.' });
  }
}

export async function getJobApplication(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.jobId)) return res.status(400).json({ success: false, message: 'Invalid job ID.' });
  try {
    const data = await Application.findOne({ user: req.user._id, job: req.params.jobId }).lean();
    return res.json({ success: true, data: publicApplication(data) });
  } catch (error) { return respondWithInternalError(res, error, { message: 'Could not load your application.' }); }
}
