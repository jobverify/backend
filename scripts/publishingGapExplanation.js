import { isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

// One primary explanation per source; implementation, runtime and public
// inventory remain separate fields so overlapping facts are still inspectable.
export const explainPublishingGap = (row, { now = new Date(), maxAgeHours = 48 } = {}) => {
  if (row.publicationOutcome === 'unknown') return 'public-inventory-unavailable'
  if (row.visibleJobs > 0) return 'published'
  if (row.isActive === false) return 'administrator-disabled'
  if (row.implementationType === 'sentinel') return 'placeholder-not-implemented'
  if (row.implementationType === 'static-empty') return 'static-empty-implementation'
  if (row.implementationType === 'discovery-only') return 'discovery-only-extraction-unimplemented'
  if (!['script', 'shared-adapter'].includes(row.implementationType)) return 'implementation-unavailable'
  const incompleteAttempt = row.attemptSuccessful === false && ['partial', 'coverage-gap'].includes(row.runtimeOutcome)
  if (row.extractionAuditFresh) {
    const persistedAt = Date.parse(row.latestAttemptCompletedAt || row.latestAttemptAt)
    const auditedAt = Date.parse(row.extractionAuditAt)
    if (row.attemptFresh && (row.runtimeOutcome === 'failed' || incompleteAttempt) && Number.isFinite(persistedAt)
      && Number.isFinite(auditedAt) && persistedAt >= auditedAt) return incompleteAttempt
        ? 'latest-persisted-check-incomplete' : 'latest-persisted-check-failed'
    const outcome = row.extractionAuditOutcome
    if (/failed|timeout|blocked|without-result/.test(outcome || '')) return 'latest-isolated-check-failed'
    if (row.extractionAuditEligibleJobs > 0) return row.inventoryDelegation?.fresh === true
      && row.inventoryDelegation.publicChildSources?.length > 0 ? 'delegated-inventory-published-under-other-sources'
      : 'observed-eligible-roles-await-publication-reconciliation'
    const evidence = row.extractionAuditEvidence?.inventoryEvidence
    if (outcome === 'complete-no-eligible-jobs' && row.extractionAuditIndiaJobs === 0
      && isFreshCompleteInventoryEvidence(evidence, { now, maxAgeHours })) return 'no-india-roles-on-checked-surface'
    if (row.extractionAuditDetailHealth?.missingDescriptions > 0) return 'native-descriptions-missing'
    if (outcome === 'unverified-zero') return 'empty-extraction-without-complete-inventory-proof'
    return 'isolated-extraction-incomplete-or-unverified'
  }
  if (row.attemptFresh && row.runtimeOutcome === 'failed') return 'latest-persisted-check-failed'
  if (row.attemptFresh && incompleteAttempt) return 'latest-persisted-check-incomplete'
  if (row.inventoryDelegation?.fresh === true && Array.isArray(row.inventoryDelegation.publicChildSources)
    && row.inventoryDelegation.publicChildSources.length > 0) return 'delegated-inventory-published-under-other-sources'
  if (row.savedJobs > 0) return 'saved-jobs-not-public-rule-inspection-required'
  if (row.attemptFresh && row.runtimeOutcome === 'verified-zero') return 'no-india-roles-on-checked-surface'
  return 'fresh-extraction-evidence-unavailable'
}
