import mongoose from 'mongoose';
import Application, { APPLICATION_STAGES } from '../models/Application.js';
import TailoredResume from '../models/TailoredResume.js';
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
    const owner = new mongoose.Types.ObjectId(String(req.user._id));
    // Only confirmed submissions belong in My applications. Employer-page
    // openings and resume requests remain outside the list and its counts.
    const [result] = await Application.aggregate([
      { $match: { user: owner, status: 'applied' } },
      { $lookup: { from: TailoredResume.collection.name, let: { owner: '$user', jobId: '$job' }, pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$user', '$$owner'] }, { $eq: ['$job', '$$jobId'] }] } } },
        { $project: { status: 1, requestedAt: 1, createdAt: 1 } }, { $limit: 1 },
      ], as: 'resume' } },
      { $set: { resume: { $first: '$resume' } } },
      { $project: {
        job: 1, status: 1, jobSnapshot: 1, firstOpenedAt: 1, appliedAt: 1,
        stage: { $ifNull: ['$stage', 'applied'] }, version: { $ifNull: ['$version', 0] },
        canConfirm: { $literal: true },
        confirmationSource: { $ifNull: ['$confirmationSource', ''] }, evidence: { $ifNull: ['$evidence', []] },
        resumeStatus: '$resume.status', resumeRequestedAt: { $ifNull: ['$resume.requestedAt', '$resume.createdAt'] },
        trackedAt: { $ifNull: ['$appliedAt', '$firstOpenedAt'] },
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
