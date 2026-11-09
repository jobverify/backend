import {
  isFreshNativeAvailability,
  readNativeRoleAvailability,
  storedAvailabilityMarker,
  supportsNativeRoleAvailability,
} from './sourceAvailability.js'

const PROVENANCE = 'source-validated-native-role-availability-v1'
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const sameRole = (a, b) => a.source === b.source && a.jobId === b.jobId && a.canonicalUrl === b.canonicalUrl
const verifiedMarker = (marker, source, role) => marker?.version === 1 && marker.provenance === PROVENANCE
  && marker.source === source && ['open', 'closed'].includes(marker.state)
  && marker.observedAt instanceof Date && Number.isFinite(+marker.observedAt)
  && marker.jobId === role.jobId && marker.brand === role.brand && typeof marker.canonicalUrl === 'string'
  && /^[a-f0-9]{64}$/.test(marker.evidenceSha256 || '')

// Read-state guards make the correction lose to an intervening observation,
// reopen, identity change or content repair. Neither timestamps nor misses are
// written: observedAt is the proof clock, not an invented time of closure.
const CAS_FIELDS = ['source', 'fingerprint', 'jobId', 'requisitionId', 'sourceUrl', 'applyUrl',
  'status', 'sourceAvailability', 'title', 'originalTitle', 'company', 'postedAt', 'sortDate',
  'postedAtProvenance', 'postedAtProvenanceValue', 'closingDate', 'scrapedAt', 'scrapedTimestamp',
  'lastSeenAt', 'updatedAt', 'missedScrapeCount', 'sourceContentHash', 'sourceContentHashVersion',
  'sourceDescription', 'description']
const casValue = (row, field) => Object.hasOwn(row, field)
  ? row[field] === null ? { $eq: null, $exists: true } : row[field]
  : { $exists: false }

export async function correctExistingNativeAvailability({ jobs, source, now, JobModel, signal }) {
  if (!supportsNativeRoleAvailability(source)) return 0
  const facts = jobs.filter(job => job?.source === source).map(readNativeRoleAvailability)
    .filter(fact => isFreshNativeAvailability(fact, now))
  const candidates = facts.filter(fact => fact.state === 'closed'
    && !facts.some(other => other.state === 'open' && sameRole(fact, other)
      && Date.parse(other.observedAt) >= Date.parse(fact.observedAt)))
  if (!candidates.length) return 0
  signal?.throwIfAborted()
  const rows = await JobModel.find({ source, $or: candidates.map(fact => ({
    jobId: fact.jobId, sourceUrl: fact.canonicalUrl,
  })) }).select('_id ' + CAS_FIELDS.join(' ')).lean().exec()
  signal?.throwIfAborted()
  const operations = []
  for (const row of rows) {
    if (!['active', 'expired'].includes(row.status)) continue
    const matches = candidates.filter(fact => fact.jobId === row.jobId && fact.canonicalUrl === row.sourceUrl
      && fact.brand === row.company && fact.title === norm(row.originalTitle || row.title))
    if (!matches.length) continue
    const fact = matches.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
    const previous = row.sourceAvailability
    if (verifiedMarker(previous, source, fact) && (+previous.observedAt > Date.parse(fact.observedAt)
      || +previous.observedAt === Date.parse(fact.observedAt))) continue
    operations.push({ updateOne: {
      filter: { _id: row._id, ...Object.fromEntries(CAS_FIELDS.map(field => [field, casValue(row, field)])) },
      update: { $set: { status: 'expired', sourceAvailability: storedAvailabilityMarker(fact) } },
      upsert: false, timestamps: false,
    } })
  }
  if (!operations.length) return 0
  signal?.throwIfAborted()
  const result = await JobModel.bulkWrite(operations, { ordered: false, timestamps: false })
  signal?.throwIfAborted()
  return result.modifiedCount ?? 0
}

// Normal content upserts for these sources omit status. A separate atomic
// transition reads the current marker, so an unknown/stale writer cannot undo
// a newer native close or reopen that committed after its earlier lookup.
export function nativeAvailabilityTransition({ job, source, fingerprint, sourceUrl, now }) {
  if (!supportsNativeRoleAvailability(source) || job.source !== source) return null
  const fact = readNativeRoleAvailability(job)
  const open = fact?.state === 'open' && isFreshNativeAvailability(fact, now) ? fact : null
  const trusted = { $and: [
    { $eq: ['$sourceAvailability.version', 1] },
    { $eq: ['$sourceAvailability.provenance', PROVENANCE] },
    { $eq: ['$sourceAvailability.source', source] },
    { $eq: ['$sourceAvailability.jobId', '$jobId'] },
    { $eq: ['$sourceAvailability.brand', '$company'] },
    { $in: ['$sourceAvailability.state', ['open', 'closed']] },
    { $eq: [{ $type: '$sourceAvailability.observedAt' }, 'date'] },
    { $eq: [{ $type: '$sourceAvailability.jobId' }, 'string'] },
    { $eq: [{ $type: '$sourceAvailability.canonicalUrl' }, 'string'] },
    { $regexMatch: { input: { $cond: [{ $eq: [{ $type: '$sourceAvailability.evidenceSha256' }, 'string'] },
      '$sourceAvailability.evidenceSha256', ''] }, regex: '^[a-f0-9]{64}$' } },
  ] }
  const storedClosed = { $and: [trusted, { $eq: ['$sourceAvailability.state', 'closed'] }] }
  let mayAdvance = false
  if (open) {
    const compatible = { $and: [
      { $eq: ['$sourceAvailability.jobId', open.jobId] },
      { $eq: ['$sourceAvailability.brand', open.brand] },
    ] }
    // The requisition is the stable native application identity. Radancy may
    // advertise a new canonical page for it; a newer fully bound proof may
    // replace that old page marker, while an older proof still loses by clock.
    mayAdvance = { $or: [{ $not: [trusted] }, { $and: [compatible,
      { $gt: [{ $literal: new Date(open.observedAt) }, '$sourceAvailability.observedAt'] } ] }] }
  }
  const set = { status: { $cond: [{ $and: [storedClosed, { $not: [mayAdvance] }] }, '$status', 'active'] } }
  if (open) set.sourceAvailability = { $cond: [mayAdvance,
    { $literal: storedAvailabilityMarker(open) }, '$sourceAvailability'] }
  return { updateOne: { filter: { source, fingerprint, jobId: job.jobId, sourceUrl },
    update: [{ $set: set }], upsert: false, timestamps: false } }
}
