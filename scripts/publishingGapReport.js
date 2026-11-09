import { classifyProviderImplementation } from './reportScriptCatalogTopology.js'
import { isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence, hasIncompleteScraperAttempt, isCompleteScraperAttempt } from '../scraper-support/utils/inventoryEvidence.js'
import { explainPublishingGap } from './publishingGapExplanation.js'
import { normalizeInventoryDelegationEvidence } from '../scraper-support/utils/inventoryDelegationEvidence.js'

const metric = value => Number.isSafeInteger(value) && value >= 0 ? value : null
const timestamp = value => {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.getTime() > 0 ? date.toISOString() : null
}
const companyKey = value => String(value || '').trim().toLowerCase()
const companyNamesAvailable = value => Array.isArray(value) && value.every(name => typeof name === 'string')
const sharedAdapters = new Set(['workday', 'publicAts', 'apiPortal'])
const implementationGapTypes = new Set(['sentinel', 'static-empty', 'discovery-only', 'missing-module', 'unreadable-module'])
const sharedAtsPlatforms = new Set(['greenhouse', 'ashby', 'lever', 'workday', 'workable', 'workable-native-api',
  'darwinbox', 'phenom', 'successfactors-rmk', 'kula', 'kula-public-api', 'eightfold'])
const countBy = (rows, field) => rows.reduce((counts, row) => {
  counts[row[field]] = (counts[row[field]] || 0) + 1
  return counts
}, {})
const fresh = (value, now, maxAgeHours) => {
  const date = timestamp(value)
  return Boolean(date && new Date(date) <= now && now - new Date(date) <= maxAgeHours * 3600000)
}
const latestExploration = row => row.extractionAuditFresh && (!row.discoveryFresh
  || new Date(row.extractionAuditAt) >= new Date(row.discoveryAt)) ? 'audit' : row.discoveryFresh ? 'discovery' : null
const exploredEligibleJobs = row => latestExploration(row) === 'audit' ? row.extractionAuditEligibleJobs
  : latestExploration(row) === 'discovery' ? row.discoveredEligibleJobs : row.eligibleJobs
const isSuccessfulAttempt = attempt => attempt?.success === true && attempt.softFailure !== true
  && attempt.upstreamOutage !== true && !attempt.failureKind

const attemptFor = (source, status, runState) => {
  // Legacy status counters survive failed/partial attempts. They are not the
  // results of lastRanAt and must never supply latest-attempt job counts.
  const savedAttempt = status?.latestAttempt
  const legacyAt = timestamp(status?.lastRanAt)
  const savedAt = timestamp(savedAttempt?.recordedAt || savedAttempt?.completedAt)
  // Older deployed runners update legacy fields without updating latestAttempt.
  // A recordedAt timestamp ties modern diagnostics to their status write. Older
  // diagnostics allow one second for the result-to-status persistence boundary.
  const legacyIsNewer = legacyAt && (!savedAt || new Date(legacyAt) - new Date(savedAt) > (savedAttempt?.recordedAt ? 0 : 1000))
  let attempt = (!legacyIsNewer && savedAttempt) || (legacyAt ? {
    completedAt: legacyAt,
    success: status.lastSuccess === true && status.softFailure !== true,
    softFailure: status.softFailure,
    failureKind: status.failureKind,
    error: status.lastError,
    staleCheckSkipped: Boolean(status.lastPartialAt && timestamp(status.lastPartialAt) === timestamp(status.lastRanAt)),
    historicalDiagnosticsMissing: true,
  } : null)
  const checkpoint = runState?.completed?.[source]
  const checkpointAttempt = checkpoint ? { ...checkpoint.result,
    completedAt: checkpoint.result?.completedAt || checkpoint.completedAt,
    evidenceOrigin: 'checkpoint', mode: runState.mode || null,
  } : null
  if (checkpointAttempt && (!attempt || new Date(checkpointAttempt.completedAt) >= new Date(attempt.completedAt || 0))) attempt = checkpointAttempt
  const pendingAt = timestamp(runState?.inProgress?.[source]?.startedAt)
  if (pendingAt && (!attempt || new Date(pendingAt) > new Date(attempt.completedAt || 0))) {
    attempt = { attemptedAt: pendingAt, pending: true, evidenceOrigin: 'checkpoint', mode: runState.mode || null }
  }
  return attempt
}

export const buildPublishingGapReport = ({ catalog = [], runtime = null, runState = null, discovery = [], extractionAudits = [],
  now = new Date(), maxAgeHours = 48, classifyImplementation = classifyProviderImplementation,
} = {}) => {
  now = new Date(now)
  if (!Number.isFinite(now.getTime()) || !(maxAgeHours > 0)) throw new TypeError('Valid now and positive maxAgeHours required')
  const databaseAvailable = runtime?.databaseAvailable === true
  const snapshotFresh = databaseAvailable && fresh(runtime.generatedAt, now, maxAgeHours)
  // Only a valid inventory collection establishes zero for an absent source.
  // A present source's missing counters remain unknown independently.
  const inventoryAvailable = databaseAvailable && Array.isArray(runtime?.inventory)
    && runtime.inventory.every(row => row && typeof row === 'object' && !Array.isArray(row)
      && (typeof row.source === 'string' || row.source === null))
    && new Set(runtime.inventory.map(row => row.source)).size === runtime.inventory.length
  const inventory = new Map((inventoryAvailable ? runtime.inventory : []).map(row => [row.source, row]))
  const inventoryFor = source => {
    const current = inventory.get(source)
    return {
      savedJobs: inventoryAvailable ? (current ? metric(current.savedJobs) : 0) : null,
      visibleJobs: inventoryAvailable ? (current ? metric(current.visibleJobs) : 0) : null,
      visibleCompanies: inventoryAvailable ? (current ? (companyNamesAvailable(current.visibleCompanies) ? current.visibleCompanies : null) : []) : null,
    }
  }
  const inventoryCountersComplete = inventoryAvailable && [...inventory.values()]
    .every(row => metric(row.savedJobs) !== null && metric(row.visibleJobs) !== null)
  const inventoryNamesComplete = inventoryAvailable && [...inventory.values()].every(row => companyNamesAvailable(row.visibleCompanies))
  const publicNamesAvailable = databaseAvailable && companyNamesAvailable(runtime?.publicCompanyNames)
  const statuses = new Map((runtime?.statuses || []).map(row => [row.source, row]))
  const discoveries = new Map(discovery.map(row => [row.source, row]))
  const audits = new Map()
  for (const audit of extractionAudits) {
    const previousAt = timestamp(audits.get(audit.source)?.completedAt)
    const auditAt = timestamp(audit.completedAt)
    // Retain one whole attempt, never counts inherited from a prior success.
    // Undated inputs retain input precedence and cannot supply fresh metrics.
    if (!previousAt || !auditAt || new Date(auditAt) >= new Date(previousAt)) audits.set(audit.source, audit)
  }
  const providers = [...new Map(catalog.map(p => [p.source, p])).values()].sort((a, b) => a.source.localeCompare(b.source))
  const catalogSources = new Set(providers.map(provider => provider.source))
  const delegationFor = (provider, attempt) => {
    const historical = provider.inventoryDelegation
    const observed = normalizeInventoryDelegationEvidence(attempt?.inventoryDelegationEvidence)
    const completedAt = timestamp(attempt?.completedAt)
    const currentObservation = Boolean(observed && observed.source === provider.source && isSuccessfulAttempt(attempt)
      && fresh(completedAt, now, maxAgeHours)
      && historical?.verified === true && Array.isArray(historical.sources)
      && observed.evidence.url === historical.evidence?.url
      && historical.sources.length === observed.sources.length && historical.sources.every(source => observed.sources.includes(source))
      && new Date(observed.verifiedAt) <= new Date(completedAt) && fresh(observed.verifiedAt, now, maxAgeHours))
    const declared = currentObservation ? { ...historical, verifiedAt: observed.verifiedAt, evidence: observed.evidence } : historical
    if (declared?.verified !== true || declared.preservesChildSourceAndCompany !== true
      || !Array.isArray(declared.sources) || !declared.sources.length
      || new Set(declared.sources).size !== declared.sources.length
      || !declared.sources.every(source => source !== provider.source && catalogSources.has(source))
      || !/^https:\/\//.test(declared.evidence?.url || '')
      || (!currentObservation && (typeof declared.evidence?.artifact !== 'string' || !declared.evidence.artifact
        || !/^[a-f0-9]{64}$/.test(declared.evidence?.sha256 || '')))) return null
    const evidenceFresh = fresh(declared.verifiedAt, now, maxAgeHours)
    const childInventories = declared.sources.map(source => ({ source, ...inventoryFor(source) }))
    const current = evidenceFresh && snapshotFresh && inventoryAvailable && publicNamesAvailable
      && childInventories.every(child => child.savedJobs !== null && child.visibleJobs !== null && child.visibleCompanies !== null)
    return { verifiedAt: timestamp(declared.verifiedAt), evidenceFresh,
      evidenceOrigin: currentObservation ? 'runtime-attempt' : 'catalog-declaration', snapshotAt: timestamp(runtime?.generatedAt),
      fresh: current, sources: [...declared.sources], preservesChildSourceAndCompany: true,
      evidence: declared.evidence, childInventories,
      publicChildSources: current ? childInventories.filter(child => child.visibleJobs > 0).map(child => child.source) : [],
      limitation: 'Child source counts are separate observations; no wrapper job matching, complete coverage or additional public company is inferred.' }
  }
  const rows = providers.map(provider => {
    const status = statuses.get(provider.source)
    const attempt = attemptFor(provider.source, status, runState)
    const implementation = classifyImplementation(provider)
    const current = inventoryFor(provider.source)
    const discovered = discoveries.get(provider.source)
    const audited = audits.get(provider.source)
    const discoveryFresh = fresh(discovered?.completedAt, now, maxAgeHours)
    const extractionAuditFresh = fresh(audited?.completedAt, now, maxAgeHours)
    const candidate = discovered?.candidate
    const sharedAdapterCompatible = sharedAdapters.has(provider.adapter)
      || (provider.adapter === 'script' && sharedAtsPlatforms.has(provider.atsPlatform))
      || sharedAtsPlatforms.has(candidate?.atsPlatform)
    const sharedAtsSources = candidate?.boardToken ? providers.filter(other => other.source !== provider.source
      && other.atsPlatform === candidate.atsPlatform && other.boardToken === candidate.boardToken
      && metric(inventory.get(other.source)?.visibleJobs) > 0).map(other => other.source) : []
    const evidence = attempt?.inventoryEvidence || null
    const evidenceFresh = fresh(evidence?.verifiedAt, now, maxAgeHours)
    const attemptFresh = fresh(attempt?.completedAt || attempt?.attemptedAt, now, maxAgeHours)
    const completeEvidence = isFreshCompleteInventoryEvidence(evidence, { now, maxAgeHours })
      && isFreshCompleteInventoryEvidence(evidence, { now: attempt?.completedAt || now, maxAgeHours })
    const partial = hasIncompleteScraperAttempt(attempt)
    const completeAttempt = completeEvidence && isCompleteScraperAttempt(attempt, { now, maxAgeHours })
    let runtimeOutcome = 'not-observed'
    if (attempt?.pending) runtimeOutcome = 'in-progress'
    else if (attempt?.skipped) runtimeOutcome = 'skipped'
    else if (attempt?.failureKind === 'coverage_gap' || attempt?.zeroJobEvidence === 'coverage-gap') runtimeOutcome = 'coverage-gap'
    else if (attempt?.failureKind === 'partial_positive' && partial) runtimeOutcome = 'partial'
    else if (attempt?.success === false || attempt?.softFailure === true || attempt?.upstreamOutage === true || attempt?.failureKind) runtimeOutcome = 'failed'
    else if (partial) runtimeOutcome = 'partial'
    else if (attempt?.success === true) {
      if (metric(attempt.jobs) === 0) runtimeOutcome = completeAttempt
        ? (isVerifiedEmptyEvidence(evidence) ? 'verified-zero' : 'no-india-jobs') : 'unverified-zero'
      else if (metric(attempt.eligibleJobs) === 0) runtimeOutcome = 'jobs-rejected'
      else if (metric(attempt.eligibleJobs) > 0) runtimeOutcome = 'eligible-jobs'
      else runtimeOutcome = 'diagnostics-missing'
    }
    const { visibleJobs, savedJobs } = current
    const rejectionCounts = Object.fromEntries(['NonIndia', 'Closed', 'InvalidUrl', 'EmptyDescription', 'NonJob', 'Old']
      .map(name => [name[0].toLowerCase() + name.slice(1), metric(attempt?.[`filtered${name}`])]))
    return {
      source: provider.source, companyName: provider.companyName || provider.company || provider.source,
      adapter: provider.adapter || null, atsPlatform: provider.atsPlatform || null, sharedAdapterCompatible,
      implementationType: implementation.type, implementationReason: implementation.reason,
      zeroResultPolicy: provider.zeroResultPolicy || null,
      isActive: typeof status?.isActive === 'boolean' ? status.isActive : null,
      latestAttemptAt: timestamp(attempt?.attemptedAt || attempt?.completedAt),
      latestAttemptCompletedAt: timestamp(attempt?.completedAt),
      lastCompleteCheckAt: timestamp(status?.lastCompleteCheckAt || (completeAttempt ? attempt.completedAt || evidence?.verifiedAt : null)),
      attemptFresh, attemptSuccessful: attempt ? isSuccessfulAttempt(attempt) : null,
      evidenceFresh, evidenceOrigin: attempt?.evidenceOrigin || (attempt ? 'database-status' : null),
      evidenceMode: attempt?.mode || (attempt ? 'live' : null),
      runtimeOutcome, publicationOutcome: visibleJobs === null ? 'unknown' : visibleJobs > 0 ? 'published' : 'not-published',
      rawJobs: metric(attempt?.rawRecords), indiaJobs: metric(attempt?.jobs), eligibleJobs: metric(attempt?.eligibleJobs),
      upstreamReportedJobs: metric(evidence?.reportedTotal),
      savedJobs, visibleJobs, visibleCompanies: current.visibleCompanies, rejectionCounts,
      inventoryDelegation: delegationFor(provider, attempt),
      completeSuccessfulCheck: attemptFresh && completeAttempt,
      inventoryEvidence: evidence, detailHealth: attempt?.detailHealth || null, zeroJobEvidence: attempt?.zeroJobEvidence || null,
      failureKind: attempt?.failureKind || null, error: attempt?.error || null,
      careerPage: provider.companyCareerPage || null,
      discoveryOutcome: discovered?.outcome || null, discoveryAt: timestamp(discovered?.completedAt), discoveryFresh,
      discoveryEvidence: discovered?.discovery || null,
      discoveredAtsBoard: candidate ? { atsPlatform: candidate.atsPlatform, boardToken: candidate.boardToken,
        bindingEvidence: candidate.bindingEvidence, sharedPublishedSources: sharedAtsSources } : null,
      discoveredEligibleJobs: discoveryFresh ? metric(discovered?.eligibleJobs) : null,
      extractionAuditOutcome: ['complete-positive-extraction', 'complete-no-eligible-jobs'].includes(audited?.outcome)
        && (audited?.detailHealth?.complete === false || metric(audited?.filterCounts?.emptyDescription) > 0)
        ? 'positive-extraction-incomplete-evidence' : audited?.outcome || null,
      extractionAuditAt: timestamp(audited?.completedAt), extractionAuditFresh,
      extractionAuditDetailHealth: audited?.detailHealth || null,
      extractionAuditRawJobs: extractionAuditFresh ? metric(audited?.rawJobs) : null,
      extractionAuditExtractedJobs: extractionAuditFresh ? metric(audited?.extractedJobs) : null,
      extractionAuditIndiaJobs: extractionAuditFresh ? metric(audited?.indiaJobs) : null,
      extractionAuditEligibleJobs: extractionAuditFresh ? metric(audited?.eligibleJobs) : null,
      extractionAuditRejectionCounts: extractionAuditFresh && audited?.filterCounts
        && typeof audited.filterCounts === 'object' && !Array.isArray(audited.filterCounts)
        ? Object.fromEntries(Object.entries(audited.filterCounts).map(([name, count]) => [name, metric(count)])) : null,
      extractionAuditEvidence: audited ? { inventoryEvidence: audited.inventoryEvidence, failureCode: audited.failureCode || null,
        failureKind: audited.failureKind || null, artifact: audited.artifact || null,
        mode: audited.mode || null, productionWrites: typeof audited.productionWrites === 'boolean' ? audited.productionWrites : null,
        supportingEvidence: Array.isArray(audited.supportingEvidence) ? audited.supportingEvidence : null } : null,
      historicalVerification: { verifiedOn: provider.verifiedOn || null, summary: provider.verifiedSurfaceSummary || null },
    }
  }).map(row => ({ ...row, gapExplanation: explainPublishingGap(row, { now, maxAgeHours }) }))
  const namesToSources = new Map()
  for (const row of rows) for (const name of new Set((row.visibleCompanies || []).map(companyKey).filter(Boolean))) {
    if (!namesToSources.has(name)) namesToSources.set(name, [])
    namesToSources.get(name).push(row.source)
  }
  const publicNames = publicNamesAvailable ? new Set(runtime.publicCompanyNames.map(companyKey).filter(Boolean)) : null
  const visibleCountsComplete = inventoryAvailable && rows.every(row => row.visibleJobs !== null)
  const catalogNamesComplete = inventoryAvailable && rows.every(row => row.visibleCompanies !== null)
  const delegations = rows.map(row => row.inventoryDelegation).filter(Boolean)
  const backlog = rows.filter(row => row.publicationOutcome !== 'published').map(row => ({
    source: row.source, companyName: row.companyName, implementationType: row.implementationType,
    sharedAdapterCompatible: row.sharedAdapterCompatible,
    reason: row.gapExplanation === 'latest-persisted-check-failed' ? 'latest-persisted-check-failed'
      : row.gapExplanation === 'delegated-inventory-published-under-other-sources' ? 'reconcile-delegated-source-coverage'
      : row.discoveredAtsBoard?.sharedPublishedSources?.length ? 'reconcile-shared-published-ats-board'
      : latestExploration(row) === 'audit' ? row.extractionAuditOutcome
      : latestExploration(row) === 'discovery' && row.discoveryOutcome !== 'already-published-not-rechecked' ? row.discoveryOutcome
      : row.runtimeOutcome === 'not-observed' ? row.implementationReason : row.runtimeOutcome,
    gapExplanation: row.gapExplanation,
    careerPage: row.careerPage,
    discoveryRequired: !(row.savedJobs > 0 || row.completeSuccessfulCheck
      || row.gapExplanation === 'delegated-inventory-published-under-other-sources'
      || (row.extractionAuditFresh && ['complete-positive-extraction', 'complete-no-eligible-jobs'].includes(row.extractionAuditOutcome))),
    priority: row.gapExplanation === 'delegated-inventory-published-under-other-sources' || row.discoveredAtsBoard?.sharedPublishedSources?.length ? 3
      : exploredEligibleJobs(row) > 0 ? 0
      : ['sentinel', 'static-empty', 'discovery-only', 'missing-module'].includes(row.implementationType) ? 1 : 2,
    observedEligibleJobs: exploredEligibleJobs(row),
    evidence: { discoveryAt: row.discoveryAt, extractionAuditAt: row.extractionAuditAt,
      discoveredAtsBoard: row.discoveredAtsBoard, extractionAudit: row.extractionAuditEvidence,
      inventoryDelegation: row.inventoryDelegation },
  })).sort((a, b) => a.priority - b.priority
    || Number(b.sharedAdapterCompatible) - Number(a.sharedAdapterCompatible)
    || (b.observedEligibleJobs || 0) - (a.observedEligibleJobs || 0)
    || a.source.localeCompare(b.source))
  return {
    schemaVersion: 1, generatedAt: now.toISOString(), freshnessHours: maxAgeHours,
    coverageLabel: 'Catalog registration coverage',
    summary: {
      registeredSources: rows.length,
      implementedSources: rows.filter(row => ['script', 'shared-adapter'].includes(row.implementationType)).length,
      completeSuccessfulChecks: rows.filter(row => row.completeSuccessfulCheck).length,
      sourcesWithoutAttemptDiagnostics: rows.filter(row => row.rawJobs == null || row.indiaJobs == null || row.eligibleJobs == null).length,
      verifiedZeroInventories: rows.filter(row => row.runtimeOutcome === 'verified-zero' && row.attemptFresh).length,
      coverageGaps: rows.filter(row => row.zeroResultPolicy === 'coverage-gap' || row.runtimeOutcome === 'coverage-gap' || implementationGapTypes.has(row.implementationType)).length,
      runtimeCoverageGaps: rows.filter(row => row.runtimeOutcome === 'coverage-gap').length,
      coverageGapPolicySources: rows.filter(row => row.zeroResultPolicy === 'coverage-gap').length,
      implementationGaps: rows.filter(row => implementationGapTypes.has(row.implementationType)).length,
      failures: rows.filter(row => row.runtimeOutcome === 'failed').length,
      sourcesWithVisibleJobs: visibleCountsComplete ? rows.filter(row => row.visibleJobs > 0).length : null,
      distinctVisibleCompanies: publicNames?.size ?? null,
      distinctVisibleCompaniesFromCatalog: catalogNamesComplete ? namesToSources.size : null,
      // Counts established fresh delegation proofs, not unknown child inventory.
      delegatingSourcesWithPublicChildInventory: delegations.filter(delegation => delegation.publicChildSources.length > 0).length,
      runtimeReconciliationComplete: snapshotFresh && publicNamesAvailable && inventoryCountersComplete && inventoryNamesComplete,
      runtimeSnapshotAt: timestamp(runtime?.generatedAt),
      runtimeEnvironment: runtime?.environment || (databaseAvailable ? 'provided-snapshot' : null),
      implementationCounts: countBy(rows, 'implementationType'), runtimeOutcomeCounts: countBy(rows, 'runtimeOutcome'),
      gapExplanationCounts: countBy(rows, 'gapExplanation'),
      discoveryOutcomeCounts: countBy(rows.filter(row => row.discoveryOutcome), 'discoveryOutcome'),
      extractionAuditOutcomeCounts: countBy(rows.filter(row => row.extractionAuditOutcome), 'extractionAuditOutcome'),
    },
    metricDefinitions: {
      coverageGaps: 'Union of sources with a coverage-gap zero-result policy, runtime coverage-gap outcome, or implementation gap; these sets overlap.',
      runtimeCoverageGaps: 'Sources whose latest classified runtimeOutcome is coverage-gap.',
      coverageGapPolicySources: 'Sources configured with zeroResultPolicy coverage-gap, independently of their current runtime outcome.',
      implementationGaps: 'Sources classified sentinel, static-empty, discovery-only, missing-module or unreadable-module.',
    },
    limitations: [
      ...(!databaseAvailable ? ['Current database inventory unavailable; saved and visible counts are unknown.'] : []),
      ...(databaseAvailable && !inventoryAvailable ? ['Current database inventory unavailable or malformed; saved and visible counts are unknown.'] : []),
      ...(inventoryAvailable && !inventoryCountersComplete ? ['Some saved or visible source counts are unknown; inventory reconciliation is incomplete.'] : []),
      ...(databaseAvailable && !publicNamesAvailable ? ['Public company-name evidence is unavailable or malformed; the distinct public company total is unknown.'] : []),
      ...(inventoryAvailable && !inventoryNamesComplete ? ['Some source company-name evidence is unavailable or malformed; company-name reconciliation is incomplete.'] : []),
      ...(databaseAvailable && !snapshotFresh ? ['Database snapshot is stale or undated; regenerate before comparing public counts.'] : []),
      'Historical provider verification is discovery context, not proof of current openings or a complete inventory.',
      'Implemented sources counts executable candidates; completeSuccessfulChecks requires fresh first-party inventory evidence.',
      'Zero observed complete checks does not establish zero successful historical scrapes; missing historical diagnostics remain unknown.',
      'Discovery and isolated extraction audits do not replace production attempt records or prove public visibility. A supported ATS feed with no India roles does not rule out other recruitment channels.',
    ],
    reconciliation: {
      untrackedSources: [...inventory.keys()].filter(source => !catalogSources.has(source)).sort(),
      sharedPublicCompanyNames: [...namesToSources].filter(([, sources]) => sources.length > 1).map(([company, sources]) => ({ company, sources })),
      aliasPublications: rows.filter(row => row.visibleJobs > 0 && row.visibleCompanies !== null && !row.visibleCompanies.some(name => companyKey(name) === companyKey(row.companyName)))
        .map(row => ({ source: row.source, catalogCompany: row.companyName, visibleCompanies: row.visibleCompanies })),
      delegatedSourceInventories: rows.filter(row => row.inventoryDelegation)
        .map(row => ({ source: row.source, catalogCompany: row.companyName, ...row.inventoryDelegation })),
    },
    rows, backlog,
  }
}

export const publishingGapCsv = rows => {
  const fields = ['source', 'companyName', 'adapter', 'atsPlatform', 'sharedAdapterCompatible', 'implementationType', 'runtimeOutcome', 'publicationOutcome', 'gapExplanation', 'isActive', 'latestAttemptAt', 'latestAttemptCompletedAt',
    'lastCompleteCheckAt', 'attemptFresh', 'attemptSuccessful', 'evidenceFresh', 'evidenceMode', 'rawJobs', 'upstreamReportedJobs', 'indiaJobs', 'eligibleJobs', 'savedJobs', 'visibleJobs',
    'visibleCompanies', 'rejectionCounts', 'zeroJobEvidence', 'inventoryEvidence', 'detailHealth', 'failureKind', 'error', 'careerPage',
    'discoveryOutcome', 'discoveryAt', 'discoveryFresh', 'discoveredEligibleJobs', 'discoveredAtsBoard', 'discoveryEvidence',
    'extractionAuditOutcome', 'extractionAuditAt', 'extractionAuditFresh', 'extractionAuditRawJobs', 'extractionAuditExtractedJobs',
    'extractionAuditIndiaJobs', 'extractionAuditEligibleJobs', 'extractionAuditRejectionCounts', 'extractionAuditDetailHealth', 'extractionAuditEvidence', 'inventoryDelegation']
  const escape = value => {
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  return `${[fields.join(','), ...rows.map(row => fields.map(field => escape(row[field])).join(','))].join('\n')}\n`
}
