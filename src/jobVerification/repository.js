import Job from '../models/Job.js';
import { normalizeJobUrl, verificationKeys } from './urls.js';

const FIELDS = 'title company companyKey companyDomain companyCareerPage sourceUrl applyUrl applicationUrlIsGeneric jobId requisitionId sourceAvailability lastSeenAt status verificationKeys';
export async function findVerificationCandidates({ urls = [], roleIds = [], company = '' } = {}) {
  const normalized = [];
  for (const url of urls.slice(0, 125)) { try { normalized.push(normalizeJobUrl(url)); } catch { /* Unusable links cannot identify a role. */ } }
  const keys = [...new Set(normalized.flatMap(sourceUrl => verificationKeys({ sourceUrl })))];
  const choices = [{ verificationKeys: { $in: keys } }, { sourceUrl: { $in: normalized } }, { applyUrl: { $in: normalized } }];
  if (company && roleIds.length) choices.push({ company: new RegExp(`^${company.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), $or: [{ jobId: { $in: roleIds } }, { requisitionId: { $in: roleIds } }] });
  return Job.find({ $or: choices }).select(FIELDS).limit(40).maxTimeMS(5000).lean();
}

export async function backfillVerificationKeys({ batchSize = 500, after, dryRun = false } = {}) {
  const jobs = await Job.find(after ? { _id: { $gt: after } } : {}).select('_id sourceUrl applyUrl sourceAvailability verificationKeys').sort({ _id: 1 }).limit(batchSize).lean();
  const changes = jobs.filter(job => JSON.stringify(job.verificationKeys || []) !== JSON.stringify(verificationKeys(job)));
  if (!dryRun && changes.length) await Job.bulkWrite(changes.map(job => ({ updateOne: { filter: { _id: job._id, sourceUrl: job.sourceUrl, applyUrl: job.applyUrl ?? null }, update: { $set: { verificationKeys: verificationKeys(job) } } } })), { ordered: false });
  return { scanned: jobs.length, updated: changes.length, after: jobs.at(-1)?._id || null };
}
