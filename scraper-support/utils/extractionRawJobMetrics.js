import { readInventoryDelegationEvidence } from './inventoryDelegationEvidence.js'
import { readSourceObservationEvidence } from './sourceObservationEvidence.js'

const data = (value, key) => {
  if (!value || typeof value !== 'object') return undefined
  try { return Object.getOwnPropertyDescriptor(value, key)?.value } catch { return undefined }
}
const count = value => Number.isSafeInteger(value) && value >= 0 && value <= 1000000

export function extractionRawJobMetrics(provider, jobs, inventoryEvidence) {
  const reported = data(inventoryEvidence, 'reportedTotal')
  if (count(reported)) return { rawJobs: reported, rawJobsBasis: 'inventory-reported-total' }
  const observations = readSourceObservationEvidence(jobs, provider.source)
  if (observations) return {
    rawJobs: observations.observedVacancyCount,
    rawJobsBasis: observations.recordKind === 'vacancy-rows' || observations.observedVacancyCount > 0
      ? 'observed-native-vacancy-rows' : 'observed-native-non-vacancy-records',
  }
  const native = data(data(jobs, '0'), 'nativeCollectionEvidence')
  const observed = data(native, 'observedListingCount'), sourceMatches = data(native, 'source') === provider.source
  const delegation = readInventoryDelegationEvidence(jobs), declared = data(provider, 'inventoryDelegation')
  const children = data(declared, 'sources'), nativeSource = data(native, 'source')
  const canonicalMatches = Boolean(delegation && delegation.source === provider.source && delegation.sources.length === 1
    && data(declared, 'verified') === true && data(declared, 'preservesChildSourceAndCompany') === true
    && Array.isArray(children) && children.length === 1 && children[0] === delegation.sources[0]
    && nativeSource === children[0] && jobs.every(job => data(job, 'source') === nativeSource))
  if ((sourceMatches || canonicalMatches) && count(observed) && observed >= jobs.length) return {
    rawJobs: observed, rawJobsBasis: sourceMatches ? 'observed-native-listing-rows' : 'observed-canonical-native-listing-rows',
  }
  return { rawJobs: jobs.length, rawJobsBasis: 'extracted-jobs-fallback',
    ...((sourceMatches || canonicalMatches) && count(observed) && observed < jobs.length ? { rawJobsCountConflict: true } : {}) }
}
