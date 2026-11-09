import Job from '../models/Job.js';
import User from '../models/User.js';
import Click from '../models/Click.js';
import JobAlertDelivery from '../models/JobAlertDelivery.js';
import AdminAudit from '../models/AdminAudit.js';
import ScraperStatus from '../models/ScraperStatus.js';
import ScraperRun from '../models/ScraperRun.js';
import JobDatasetSummary from '../models/JobDatasetSummary.js';
import { decodeScraperRunSourceKey } from '../../scraper-support/utils/scraperPersistence.js';
import { summarizeScraperHistory } from '../../scraper-support/utils/scraperOutcome.js';
import { refreshJobDatasetSummary } from './jobDatasetSummaryService.js';

// Keep the source configuration, but remove all recorded execution state.
const resetStatus = scraper => ({
  source: scraper.source,
  companyName: scraper.companyName,
  url: scraper.url,
  isActive: false,
  lastRanAt: new Date(0),
  lastSuccess: true,
});

async function purgeCompanyTraces(names, source) {
  // Preferences and orphaned snapshots can also belong to another source for
  // the same employer. Keep names which still have jobs from another source.
  const retained = new Set(await Job.distinct('company', { company: { $in: names }, source: { $ne: source } }));
  const orphaned = names.filter(name => !retained.has(name));
  if (orphaned.length) {
    await User.updateMany({ $or: [
      { 'profile.profilePreferenceFilters.company': { $in: orphaned } },
      { 'profile.telegramAlertFilters.company': { $in: orphaned } },
    ] }, { $pull: {
      'profile.profilePreferenceFilters.company': { $in: orphaned },
      'profile.telegramAlertFilters.company': { $in: orphaned },
    } });
    await JobAlertDelivery.deleteMany({ 'jobSnapshot.company': { $in: orphaned } });
  }
  // Refresh mutable summaries; shared immutable hiring history is preserved.
  await JobDatasetSummary.deleteMany({ companies: { $in: names } });
}

async function purgeJobReferences(ids) {
  await User.updateMany({ savedJobs: { $in: ids } }, { $pull: { savedJobs: { $in: ids } } });
  await Click.deleteMany({ job: { $in: ids } });
  await JobAlertDelivery.deleteMany({ job: { $in: ids } });
  await AdminAudit.deleteMany({ targetType: 'Job', targetId: { $in: ids } });
}

export async function purgeScraperData(scraper, { assertActive = async () => {} } = {}) {
  // Pause first, including on failure, so a retry cannot race a scheduled run.
  await ScraperStatus.updateOne({ _id: scraper._id }, { $set: { isActive: false } });
  let deletedCount = 0;
  const progress = await ScraperStatus.findById(scraper._id).select('+purgeJobIds').lean();
  let pendingIds = progress?.purgeJobIds || [];
  // Persist each batch until both reference sweeps finish, so a failure after
  // deleting jobs can still recover their IDs on the next purge request.
  while (true) {
    await assertActive();
    const jobs = await Job.find({ source: scraper.source, ...(pendingIds.length ? { _id: { $in: pendingIds } } : {}) }).select('_id company').limit(500).lean();
    const ids = pendingIds.length ? pendingIds : jobs.map(job => job._id);
    if (!ids.length) break;
    const companies = [...new Set(jobs.map(job => job.company).filter(Boolean))];
    await ScraperStatus.updateOne({ _id: scraper._id }, { $set: { purgeJobIds: ids } });
    await purgeJobReferences(ids);
    await purgeCompanyTraces(companies, scraper.source);
    deletedCount += (await Job.deleteMany({ _id: { $in: ids }, source: scraper.source })).deletedCount;
    // Also catch references written after the first sweep while jobs existed.
    await purgeJobReferences(ids);
    await ScraperStatus.updateOne({ _id: scraper._id }, { $unset: { purgeJobIds: 1 } });
    pendingIds = [];
  }

  await assertActive();
  await purgeCompanyTraces([scraper.companyName].filter(Boolean), scraper.source);
  await AdminAudit.deleteMany({ targetType: 'ScraperStatus', targetId: scraper._id });

  // Older run maps can contain literal dots; rebuilding the map also handles
  // escaped keys without interpreting a source name as a MongoDB field path.
  for await (const run of ScraperRun.collection.find({})) {
    const entries = Object.entries(run.sources || {});
    const remaining = entries.filter(([key]) => decodeScraperRunSourceKey(key) !== scraper.source);
    if (remaining.length === entries.length) continue;
    await assertActive();
    if (!remaining.length) {
      await ScraperRun.collection.deleteOne({ _id: run._id });
      continue;
    }
    const results = remaining.map(([, result]) => result);
    await ScraperRun.collection.updateOne({ _id: run._id }, { $set: {
      sources: Object.fromEntries(remaining),
      overall: summarizeScraperHistory(results),
    } });
  }

  const replacement = new ScraperStatus(resetStatus(scraper)).toObject();
  await assertActive();
  delete replacement._id;
  await ScraperStatus.replaceOne({ _id: scraper._id }, { ...replacement, _id: scraper._id });
  await refreshJobDatasetSummary();
  return { id: String(scraper._id), source: scraper.source, deletedCount, scraper: await ScraperStatus.findById(scraper._id).lean() };
}
