export const INVENTORY_EVIDENCE = Symbol.for('jobverify.inventory-evidence')

const INVENTORY_STATUSES = new Set([
  'verified-empty',
  'complete-inventory',
  'discovery-only',
  'coverage-gap',
  'unverified',
])

const toHttpUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const toNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : fallback
}

const toOptionalNonNegativeInteger = (value) => {
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null
}

const toIsoTimestamp = (value) => {
  if (value == null || value === '') return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString()
}

const invalidEvidence = () => ({
  status: 'unverified',
  surface: null,
  firstParty: false,
  listingComplete: false,
  pagesFetched: 0,
  reportedTotal: null,
  indiaFacetCount: null,
  verifiedAt: null,
  reason: 'invalid-inventory-evidence',
})

export const isVerifiedEmptyEvidence = (evidence = {}) => (
  evidence?.status === 'verified-empty'
  && evidence.firstParty === true
  && evidence.listingComplete === true
  && Boolean(toHttpUrl(evidence.surface))
  && toNonNegativeInteger(evidence.pagesFetched, -1) >= 1
  && (evidence.reportedTotal == null || toOptionalNonNegativeInteger(evidence.reportedTotal) === 0)
  && (evidence.indiaFacetCount == null || toOptionalNonNegativeInteger(evidence.indiaFacetCount) === 0)
  && Boolean(toIsoTimestamp(evidence.verifiedAt))
)

export const normalizeInventoryEvidence = (evidence = {}) => {
  const status = INVENTORY_STATUSES.has(evidence?.status)
    ? evidence.status
    : 'unverified'
  const normalized = {
    status,
    surface: toHttpUrl(evidence?.surface),
    firstParty: evidence?.firstParty === true,
    listingComplete: evidence?.listingComplete === true,
    ...(typeof evidence?.lifecycleCleanupAllowed === 'boolean' ? {lifecycleCleanupAllowed:evidence.lifecycleCleanupAllowed} : {}),
    pagesFetched: toNonNegativeInteger(evidence?.pagesFetched),
    reportedTotal: toOptionalNonNegativeInteger(evidence?.reportedTotal),
    indiaFacetCount: toOptionalNonNegativeInteger(evidence?.indiaFacetCount),
    verifiedAt: toIsoTimestamp(evidence?.verifiedAt),
    reason: String(evidence?.reason ?? '').trim() || null,
  }

  if (status === 'verified-empty' && !isVerifiedEmptyEvidence(normalized)) {
    return {...invalidEvidence(), ...(normalized.lifecycleCleanupAllowed === false ? {lifecycleCleanupAllowed:false} : {})}
  }

  return normalized
}

export const attachInventoryEvidence = (jobs, evidence) => {
  if (!Array.isArray(jobs)) {
    throw new TypeError('Inventory evidence can only be attached to a jobs array')
  }

  Object.defineProperty(jobs, INVENTORY_EVIDENCE, {
    configurable: true,
    value: normalizeInventoryEvidence(evidence),
  })
  return jobs
}

export const readInventoryEvidence = (jobs) => (
  Array.isArray(jobs) ? jobs[INVENTORY_EVIDENCE] || null : null
)

// A complete configured inventory does not override a source's explicit hold.
// Retain it on inventory evidence so empty arrays stay protected after mapping.
export const sourceLifecycleCleanupForbidden = jobs => Array.isArray(jobs) && (
  jobs.some(job => job?.lifecycleCleanupAllowed === false || job?.sourceScopeComplete === false)
  || jobs[Symbol.for('jobverify.verified-recruitment-observations')]?.lifecycleCleanupAllowed === false
  || readInventoryEvidence(jobs)?.lifecycleCleanupAllowed === false
)

// Array.map drops non-enumerable inventory metadata. Company wrappers use this
// when adding labels or timestamps to a shared adapter's validated results.
export const mapJobsWithInventoryEvidence = (jobs, transform) => {
  const mapped = jobs.map(transform)
  const evidence = readInventoryEvidence(jobs)
  if (!evidence) return mapped
  const incomplete = mapped.some(job => job?.sourceListingComplete === false)
  return attachInventoryEvidence(mapped, incomplete && evidence.listingComplete !== false ? { ...evidence, status: 'discovery-only', listingComplete: false,
    reason: 'company-wrapper-limited-inventory' } : evidence)
}

/** A complete current check needs fetched inventory, not just a status label. */
export const isFreshCompleteInventoryEvidence = (evidence, {
  now = new Date(), maxAgeHours = 48,
} = {}) => {
  if (!evidence || evidence.firstParty !== true || evidence.listingComplete !== true
    || !toHttpUrl(evidence.surface) || toNonNegativeInteger(evidence.pagesFetched, -1) < 1
    || !['complete-inventory', 'verified-empty'].includes(evidence.status)) return false
  const at = toIsoTimestamp(evidence.verifiedAt)
  const reference = toIsoTimestamp(now)
  if (!at || !reference || !(maxAgeHours > 0)) return false
  const age = new Date(reference) - new Date(at)
  return age >= 0 && age <= maxAgeHours * 3600000
    && (evidence.status !== 'verified-empty' || isVerifiedEmptyEvidence(evidence))
}

const UNVERIFIED_ZERO_OUTCOMES = new Set([
  'coverage-gap', 'blocked-zero', 'unverified-zero', 'discovery-only', 'unverified', 'unverified-empty',
])

// A measured extraction can finish even when eligibility filters leave nothing
// safe to use for lifecycle cleanup. Only the saver's explicit hold code and
// complete detail diagnostics distinguish that case from an incomplete check.
const isEligibilityOnlyLifecycleHold = attempt => attempt.staleCheckReasonCode === 'no-eligible-jobs'
  && (attempt.eligibleJobs ?? attempt.eligibleJobsFound) === 0
  && attempt.detailHealth?.complete === true

/** Explicit extraction failures still override inventory completeness labels. */
export const hasIncompleteScraperAttempt = (attempt) => Boolean(attempt && (
  attempt.partial === true || (attempt.staleCheckSkipped === true && !isEligibilityOnlyLifecycleHold(attempt)) || attempt.skipped === true
  || attempt.softFailure === true || attempt.upstreamOutage === true || attempt.failureKind
  || attempt.detailHealth?.complete === false || attempt.filteredEmptyDescription > 0
  || UNVERIFIED_ZERO_OUTCOMES.has(attempt.zeroJobEvidence)
))

/** Historical checks retain their completion clock; current freshness is separate. */
export const isCompleteScraperAttempt = (attempt, { now = new Date(), maxAgeHours = 48 } = {}) => {
  if (attempt?.success !== true || hasIncompleteScraperAttempt(attempt)) return false
  const reference = toIsoTimestamp(now)
  const suppliedCompletion = attempt.completedAt != null && attempt.completedAt !== ''
  const completedAt = suppliedCompletion ? toIsoTimestamp(attempt.completedAt) : reference
  if (!reference || !completedAt || +new Date(completedAt) <= 0 || new Date(completedAt) > new Date(reference)) return false
  return isFreshCompleteInventoryEvidence(attempt.inventoryEvidence, { now: completedAt, maxAgeHours })
}
