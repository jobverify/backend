import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence, readInventoryEvidence, isFreshCompleteInventoryEvidence } from './inventoryEvidence.js'
import { classifyScraperError } from './failureClassification.js'
import { publicRecruitmentPath as publicPath, summarizeRecruitmentRecoveryAudit as auditSummary } from './recruitmentRecoveryAudit.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('./emptyOnlyRecruitmentSources.json', import.meta.url), 'utf8'))
const sources = new Map(manifest.sources.map(entry => [entry.source, entry]))
const observations = Symbol.for('jobverify.verified-recruitment-observations')
const limits = { maxRequests: 16, maxPages: 6, maxDetails: 8, sourceTimeoutMs: 45000 }
const transportOption = key => /fetch|^(?:request|searchJobs|searchRoles|createSession|transport|browser|page|session)$/.test(key)
const isInjectedTransport = options => Object.entries(options).some(([key, value]) =>
  key !== 'emptyOnlyRecovery' && value != null && (transportOption(key)
    || typeof value === 'function' && key !== 'now'))
const diagnostic = (jobs, entry, provider, value) => {
  Object.defineProperty(jobs, 'emptyOnlyRecruitmentRecovery', { configurable: true, value: {
    source: entry.source, originalReaderSHA256: entry.sha256,
    sourceScopeComplete: false, lifecycleCleanupAllowed: false, ...value,
  } })
  if (!readInventoryEvidence(jobs)) {
    const detail = [value.status, ...(value.unresolved || []),
      ...(value.failures || []).slice(0, 3).map(failure => [failure.stage,
        failure.status == null ? null : 'HTTP ' + failure.status, failure.code, failure.message].filter(Boolean).join(' '))]
      .filter(Boolean).join('; ').slice(0, 1024)
    attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: publicPath(provider.companyCareerPage),
      firstParty: (value.receipts || []).some(receipt => receipt.status === 200),
      listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: value.receipts?.length || 0,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
      reason: 'empty-only-recruitment-recovery; ' + detail })
  }
  return jobs
}

/**
 * Current acquisition for the audited legacy readers which cannot emit roles.
 * The original reader runs first; none of its exceptions are handled here.
 * Injected callbacks other than the clock stay isolated unless emptyOnlyRecovery supplies an
 * explicit recovery transport. emptyOnlyRecovery:false opts out of acquisition.
 */
export async function recoverEmptyOnlyRecruitment(jobs, provider, options = {}) {
  const entry = sources.get(provider.source)
  if (!entry || !Array.isArray(jobs) || jobs.length > 0 || options.emptyOnlyRecovery === false
    || isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs))
    || typeof provider.modulePath !== 'string' || !path.isAbsolute(provider.modulePath)
    || path.resolve(provider.modulePath).toLowerCase() !== path.resolve(root, entry.module).toLowerCase()) return jobs
  const explicit = options.emptyOnlyRecovery && typeof options.emptyOnlyRecovery === 'object'
    ? options.emptyOnlyRecovery : null
  if (isInjectedTransport(options) && !explicit) return jobs
  const requestOptions = { signal: options.signal }
  for (const [key, cap] of Object.entries(limits)) {
    const supplied = explicit?.[key] ?? options[key]
    if (supplied != null && (!Number.isSafeInteger(supplied) || supplied <= 0)) return jobs
    requestOptions[key] = Math.min(supplied ?? cap, cap)
  }
  if (typeof (explicit?.now ?? options.now) === 'function') requestOptions.now = explicit?.now ?? options.now
  for (const key of ['fetchPage', 'fetchJson', 'fetchImpl']) {
    if (typeof explicit?.[key] === 'function') requestOptions[key] = explicit[key]
  }
  try {
    options.signal?.throwIfAborted()
    const { createVerifiedRecruitmentScraper } = await import('./verifiedRecruitment.js')
    const recovered = await createVerifiedRecruitmentScraper({ ...provider,
      requireCorporateIdentityMatch: true,
      // These enable current declared discovery, never inferred ATS accounts.
      prioritizeRecruitmentSearch: provider.prioritizeRecruitmentSearch ?? true,
      preferIndiaInventory: provider.preferIndiaInventory ?? true,
      searchIndiaWithoutFacet: provider.searchIndiaWithoutFacet ?? true,
      discoverLiteralRecruitmentData: provider.discoverLiteralRecruitmentData ?? true,
      allowVerifiedCorporateRedirects: provider.allowVerifiedCorporateRedirects ?? true,
      allowDeclaredExternalCareersPages: provider.allowDeclaredExternalCareersPages ?? true,
    }).run(requestOptions)
    options.signal?.throwIfAborted()
    if (!recovered.length) return diagnostic(jobs, entry, provider, {
      status: 'no-qualified-india-roles', ...auditSummary(recovered[observations]),
    })
    for (const job of recovered) Object.assign(job, {
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    })
    const evidence = readInventoryEvidence(recovered)
    attachInventoryEvidence(recovered, { ...evidence, lifecycleCleanupAllowed: false, listingComplete: false })
    return diagnostic(recovered, entry, provider, {
      status: 'observed-india-roles', ...auditSummary(recovered[observations]), returnedIndiaJobs: recovered.length,
    })
  } catch (error) {
    options.signal?.throwIfAborted()
    const classification = classifyScraperError(error)
    return diagnostic(jobs, entry, provider, { status: 'unavailable',
      failureKind: classification.failureKind, softFailure: classification.softFailure,
      ...auditSummary(error?.recruitmentObservations),
    })
  }
}
