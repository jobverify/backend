import { parseWorkdayNativeLifecycleDate } from '../myworkday/nativeLifecycleDates.js'
import { normalizeLifecycleDate } from '../../src/utils/jobLifecycle.js'
import { normalizeScrapedJob } from './normalizeScrapedJob.js'
import { analyzePublishableJobs } from './publishableJobMetrics.js'
import { applicationIdentityLookup, resolveApplicationIdentities } from './applicationIdentity.js'

// Native clock corrections apply only to roles observed by this source. They
// neither insert ineligible roles nor authorize a source-wide lifecycle sweep.
const nativeDatePatch = job => {
  if (job.sourceDateProvenance !== 'workday-cxs-jobPostingInfo'
    || job.sourceDetailComplete === false || !job.sourceRawDates) return null
  try {
    const start = parseWorkdayNativeLifecycleDate(job.sourceRawDates.startDate, { field: 'startDate' })
    const end = parseWorkdayNativeLifecycleDate(job.sourceRawDates.endDate, { field: 'endDate' })
    if (!start.date && !end.date) return null
    const patch = {}
    if (start.date) {
      const actual = normalizeLifecycleDate(job.postingDate) || normalizeLifecycleDate(job.postedAt)
      if (!actual || +actual !== +start.date || job.postingDatePrecision !== start.precision
        || job.sourcePostingDateIsExact !== start.exact) return null
      patch.postedAt = start.date
      patch.sortDate = start.date
    }
    if (end.date) {
      const actual = normalizeLifecycleDate(job.closingDate)
      if (!actual || +actual !== +end.date || job.closingDatePrecision !== end.precision
        || job.sourceClosingDateIsExact !== end.exact) return null
      patch.closingDate = new Date(+end.date)
      if (!end.exact) patch.closingDate.setUTCHours(24, 0, 0, 0)
    }
    return patch
  } catch (error) {
    if (error.code === 'WORKDAY_NATIVE_DATE_INVALID') return null
    throw error
  }
}

const roleId = job => String(job.requisitionId || job.jobId || '').trim().toLowerCase()

export const correctExistingSourceLifecycleDates = async ({ jobs, source, now, JobModel, signal }) => {
  const candidates = []
  for (const job of jobs) {
    if (job.source !== undefined && job.source !== source) continue
    const patch = nativeDatePatch(job)
    if (!patch) continue
    const { filterCounts } = analyzePublishableJobs([job], { now })
    if (!filterCounts.old && !filterCounts.closed) continue
    candidates.push({ job: normalizeScrapedJob(job, { source }), patch })
  }
  if (!candidates.length) return 0
  signal?.throwIfAborted()
  const existing = await JobModel.find({ $and: [
    { source }, applicationIdentityLookup(candidates.map(candidate => candidate.job)),
  ] }).select('_id source fingerprint jobId requisitionId applicationUrlIsGeneric applyUrl sourceUrl city title company location postedAt closingDate sortDate lastSeenAt updatedAt').lean().exec()
  signal?.throwIfAborted()
  const identities = resolveApplicationIdentities(candidates.map(candidate => candidate.job), existing)
  const grouped = new Map()
  for (let index = 0; index < identities.length; index += 1) {
    const identity = identities[index]
    const { previous } = identity
    if (!previous || previous.source !== source || !roleId(previous)
      || roleId(previous) !== roleId(identity.job)) continue
    const key = String(previous._id)
    const patch = candidates[index].patch
    const prior = grouped.get(key)
    if (prior && JSON.stringify(prior.patch) !== JSON.stringify(patch)) {
      prior.conflicting = true
    } else if (!prior) grouped.set(key, { previous, patch })
  }
  const operations = [...grouped.values()].filter(item => !item.conflicting).map(({ previous, patch }) => ({
    updateOne: {
      filter: {
        _id: previous._id, source, fingerprint: previous.fingerprint,
        [previous.requisitionId ? 'requisitionId' : 'jobId']: previous.requisitionId || previous.jobId,
        // A newer observation or date repair after our lookup must win. Missing
        // values need an existence guard because Mongo null also matches absent.
        ...Object.fromEntries(['postedAt', 'closingDate', 'sortDate', 'lastSeenAt', 'updatedAt'].map(field => [field,
          Object.hasOwn(previous, field)
            ? previous[field] === null ? { $eq: null, $exists: true } : previous[field]
            : { $exists: false },
        ])),
        $or: Object.entries(patch).map(([field, date]) => ({ [field]: { $ne: date } })),
      },
      update: { $set: patch }, upsert: false, timestamps: false,
    },
  }))
  if (!operations.length) return 0
  signal?.throwIfAborted()
  const result = await JobModel.bulkWrite(operations, { ordered: false, timestamps: false })
  signal?.throwIfAborted()
  return result.modifiedCount ?? 0
}
