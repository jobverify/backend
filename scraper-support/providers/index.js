import path from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { pathToFileURL } from 'url'

import { expandApiPortalProviderTemplate } from './apiPortalTemplates.js'
import { CANONICAL_CITIES } from '../utils/cities.js'
import {
  getDefaultDryRunRelativePath,
  getDefaultScriptModulePath,
  isWorkdayBackedProvider,
  resolveScraperSourceDirectory,
} from './sourcePaths.js'
import {
  LEGACY_PROVIDER_BASE_DIR,
  SCRAPER_DIR,
  SUPPORT_PROVIDER_DIR,
} from '../supportPaths.js'
import { TARGETED_OPENING_PROVIDERS } from './targetedOpeningProviders.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { attachInventoryDelegationEvidence, readInventoryDelegationEvidence } from '../utils/inventoryDelegationEvidence.js'
import { attachSourceObservationEvidence, readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { hasMatchingPublicAtsBinding } from '../utils/publicAtsIdentity.js'
import { buildHttpError, parseRetryAfterHeader } from '../utils/fetch.js'
import {FINOLEX_CATALOG} from '../../scraper/finolexindustrieslimited/catalog.js'
import {GOODNOTES_CATALOG} from '../../scraper/goodnotes/catalog.js'
import {DENTALKART_CATALOG} from '../../scraper/dentalkart/catalog.js'
import {DHAN_CATALOG} from '../../scraper/dhan/catalog.js'

const currentDir = SUPPORT_PROVIDER_DIR
const scraperDir = SCRAPER_DIR
export const DEFAULT_PROVIDER_EXTENSION_DIR = path.join(SUPPORT_PROVIDER_DIR, 'providerExtensions')
const WORKDAY_AUTHORITATIVE_EMPTY = Symbol.for('jobverify.workday.authoritative-empty')
const WORKDAY_COUNTRY_INVENTORY_PROOF = Symbol.for('jobverify.workday.country-inventory-proof')
const OFFICIAL_ATS_DISCOVERY = Symbol.for('jobverify.official-ats-discovery')
const RECRUITMENT_OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')
const workdayCompanies = JSON.parse(
  readFileSync(path.resolve(currentDir, '../myworkday/companies.json'), 'utf-8'),
)
const customProviders = JSON.parse(
  readFileSync(path.resolve(currentDir, 'customProviders.json'), 'utf-8'),
)
const apiPortalProviders = JSON.parse(
  readFileSync(path.resolve(currentDir, 'apiPortalProviders.json'), 'utf-8'),
).map((provider) => expandApiPortalProviderTemplate(provider))

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const MONGODB_SHARED_INDIA_LOCATION_LABELS = Object.freeze([
  'India',
  'India Offsite',
  'IND-Trivandrum-Equifax Analytics-PEC',
])
const MONGODB_INDIA_LOCATION_PATTERN = [
  ...new Set([
    ...Object.keys(CANONICAL_CITIES),
    ...Object.values(CANONICAL_CITIES),
    ...MONGODB_SHARED_INDIA_LOCATION_LABELS,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)),
]
  .sort((left, right) => right.length - left.length || left.localeCompare(right))
  .map((value) => escapeRegex(value))
  .join('|')

export const loadProviderExtensions = (
  extensionDir = DEFAULT_PROVIDER_EXTENSION_DIR,
) => {
  if (!existsSync(extensionDir)) return []

  return readdirSync(extensionDir)
    .filter((fileName) => fileName.toLowerCase().endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .flatMap((fileName) => {
      const filePath = path.join(extensionDir, fileName)
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))

      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === 'object') return [parsed]
      return []
    })
}

const getCompanyDomain = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

const normalizeCompanyDomain = (value) => {
  if (!value) return null
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
    return value.replace(/^www\./i, '').toLowerCase()
  }
  return getCompanyDomain(value)
}

const applyProviderSpecificOverrides = (provider = {}) => {
  if (provider.source !== 'mongodb') return provider

  const include = Array.isArray(provider.config?.resultFilter?.include)
    ? provider.config.resultFilter.include
    : []
  const hasLocationInclude = include.some((rule) => rule?.field === 'location')

  if (!hasLocationInclude) return provider

  return {
    ...provider,
    config: {
      ...(provider.config || {}),
      resultFilter: {
        ...(provider.config?.resultFilter || {}),
        include: include.map((rule) => (
          rule?.field === 'location'
            ? { ...rule, pattern: MONGODB_INDIA_LOCATION_PATTERN }
            : rule
        )),
      },
    },
  }
}

const getDefaultDryRunFile = (provider = {}) =>
  path.join(scraperDir, getDefaultDryRunRelativePath(provider))

const isWithinDirectory = (filePath, directoryPath) => {
  const normalizedFilePath = path.resolve(filePath)
  const normalizedDirectoryPath = path.resolve(directoryPath)
  const relativePath = path.relative(normalizedDirectoryPath, normalizedFilePath)

  return relativePath === ''
    || (
      relativePath
      && !relativePath.startsWith('..')
      && !path.isAbsolute(relativePath)
    )
}

const resolveProviderDryRunFile = (provider = {}) => {
  const defaultDryRunFile = getDefaultDryRunFile(provider)
  if (!provider.dryRunFile) {
    if (provider.adapter === 'script') {
      const resolvedModulePath = resolveProviderModulePath(provider)
      if (resolvedModulePath && path.isAbsolute(resolvedModulePath)) {
        const moduleDir = path.dirname(resolvedModulePath)
        if (isWithinDirectory(moduleDir, scraperDir)) {
          return path.join(moduleDir, 'jobs.json')
        }
      }
    }

    return defaultDryRunFile
  }

  if (!path.isAbsolute(provider.dryRunFile)) {
    return path.join(scraperDir, provider.dryRunFile)
  }

  return isWithinDirectory(provider.dryRunFile, scraperDir)
    ? provider.dryRunFile
    : defaultDryRunFile
}

const resolveProviderModuleFilePath = (modulePath) => (
  path.isAbsolute(modulePath)
    ? modulePath
    : path.resolve(LEGACY_PROVIDER_BASE_DIR, modulePath)
)

const resolveProviderModulePath = (provider = {}) => {
  if (provider.adapter !== 'script') {
    return provider.modulePath || null
  }

  if (isWorkdayBackedProvider(provider)) {
    if (provider.modulePath && path.isAbsolute(provider.modulePath)) {
      return path.join(
        resolveScraperSourceDirectory(provider, { baseDir: scraperDir }),
        'script.js',
      )
    }

    return resolveProviderModuleFilePath(getDefaultScriptModulePath(provider))
  }

  if (provider.modulePath) {
    return resolveProviderModuleFilePath(provider.modulePath)
  }

  return resolveProviderModuleFilePath(getDefaultScriptModulePath(provider, { workday: false }))
}

const PROVIDER_DEFAULTS = {
  workday: {
    atsPlatform: 'workday',
    countryFilter: 'India',
    paginationStrategy: 'next-button',
    extractionStrategy: 'dom+detail-page',
    parser: 'workday',
    normalizationProfile: 'engineering-default',
  },
  script: {
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'custom',
    extractionStrategy: 'dom',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
  },
  apiPortal: {
    atsPlatform: 'official-company-careers',
    countryFilter: 'India',
    paginationStrategy: 'api-driven',
    extractionStrategy: 'api+optional-detail',
    parser: 'api-portal',
    normalizationProfile: 'engineering-default',
  },
  publicAts: {
    countryFilter: 'India', paginationStrategy: 'complete-public-posting-api',
    parser: 'validated-public-ats', normalizationProfile: 'engineering-default',
  },
}

const ZERO_RESULT_POLICIES = new Set([
  'coverage-gap',
  'discovery-only',
  'evidence-required',
])

export const resolveZeroResultPolicy = (provider = {}) => {
  if (ZERO_RESULT_POLICIES.has(provider.zeroResultPolicy)) {
    return provider.zeroResultPolicy
  }

  const inventoryMetadata = [
    provider.atsPlatform,
    provider.backfillMode,
    provider.extractionStrategy,
    provider.paginationStrategy,
  ].filter(Boolean).join(' ')

  return /sentinel|verified-empty-state|exact-name-sentinel/i.test(inventoryMetadata)
    ? 'coverage-gap'
    : 'evidence-required'
}

export const hydrateProviderCatalogEntry = (provider = {}) => {
  const source = provider.source || provider.name
  const companyName = provider.companyName || provider.company
  const adapter = provider.adapter || 'workday'
  const defaults = PROVIDER_DEFAULTS[adapter] || {}
  const companyCareerPage = provider.companyCareerPage || provider.baseUrl || null
  const normalizedProvider = applyProviderSpecificOverrides({
    ...provider,
    source,
  })
  const draftProvider = {
    ...defaults,
    ...normalizedProvider,
    source,
    companyName,
    adapter,
    companyCareerPage,
  }
  const modulePath = resolveProviderModulePath(draftProvider)
  const sourceDirectory = (
    draftProvider.adapter === 'script'
      && modulePath
      && path.isAbsolute(modulePath)
      && isWithinDirectory(path.dirname(modulePath), scraperDir)
  )
    ? path.dirname(modulePath)
    : resolveScraperSourceDirectory(draftProvider, { baseDir: scraperDir })
  const dryRunFile = resolveProviderDryRunFile(draftProvider)

  return {
    ...draftProvider,
    zeroResultPolicy: resolveZeroResultPolicy(draftProvider),
    dryRunFile,
    modulePath,
    sourceDirectory,
    companyDomain: normalizeCompanyDomain(
      provider.companyDomain || companyCareerPage || provider.baseUrl,
    ),
  }
}

const decorateJobWithProviderMetadata = (job, provider) => ({
  ...job,
  company: job.company || provider.companyName,
  source: job.source || provider.source,
  country: Object.hasOwn(job, 'country') ? job.country
    : job.sourceCountryScopeUnresolved === true ? null : provider.countryFilter || 'India',
  companyCareerPage: job.companyCareerPage || provider.companyCareerPage,
  companyDomain: Object.hasOwn(job, 'companyDomain') ? job.companyDomain : provider.companyDomain,
  atsPlatform: job.atsPlatform || provider.atsPlatform,
  applyUrl: job.applyUrl || job.link || null,
  sourceUrl: job.sourceUrl || job.link || null,
})

const hasVerifiedEmptySnapshotDisposition = (provider = {}) => {
  const inventoryMetadata = [
    provider.atsPlatform,
    provider.backfillMode,
    provider.extractionStrategy,
    provider.paginationStrategy,
  ].filter(Boolean).join(' ')

  return provider.backfillMode === 'verified-empty-state'
    || provider.atsPlatform === 'verified-first-party-careers-empty-result'
    || /no-current-openings|no-openings|official-ats-empty-state|return-empty-when-no-openings|without-current-openings/i.test(inventoryMetadata)
}

const hasVerifiedEmptyProviderSnapshot = (provider = {}) => (
  hasVerifiedEmptySnapshotDisposition(provider)
  && Number(provider.verifiedPublicJobCount) === 0
  && Number(provider.verifiedIndiaJobCount) === 0
  && Boolean(provider.companyCareerPage)
  && Boolean(provider.verifiedOn)
)

const buildVerifiedEmptyProviderEvidence = (provider = {}) => ({
  status: 'verified-empty',
  surface: provider.companyCareerPage,
  firstParty: true,
  listingComplete: true,
  pagesFetched: 1,
  reportedTotal: 0,
  indiaFacetCount: 0,
  verifiedAt: provider.verifiedOn,
  reason: provider.verifiedSurfaceSummary || `verified-empty-provider-snapshot:${provider.source}`,
})

const hasCompleteInventoryZeroIndiaSnapshotDisposition = (provider = {}) => {
  const inventoryMetadata = [
    provider.atsPlatform,
    provider.backfillMode,
    provider.extractionStrategy,
    provider.paginationStrategy,
    provider.verifiedSurfaceSummary,
  ].filter(Boolean).join(' ')

  return /no-verified-india-openings|no india openings|zero india openings|without-enumerable-india-listings|outside india/i.test(inventoryMetadata)
}

const hasCompleteInventoryZeroIndiaProviderSnapshot = (provider = {}) => (
  hasCompleteInventoryZeroIndiaSnapshotDisposition(provider)
  && Number(provider.verifiedPublicJobCount) > 0
  && Number(provider.verifiedIndiaJobCount) === 0
  && Boolean(provider.companyCareerPage)
  && Boolean(provider.verifiedOn)
)

const buildCompleteInventoryZeroIndiaProviderEvidence = (provider = {}) => ({
  status: 'complete-inventory',
  surface: provider.companyCareerPage,
  firstParty: true,
  listingComplete: true,
  pagesFetched: 1,
  reportedTotal: Number(provider.verifiedPublicJobCount),
  indiaFacetCount: 0,
  verifiedAt: provider.verifiedOn,
  reason: provider.verifiedSurfaceSummary || `complete-inventory-zero-india-provider-snapshot:${provider.source}`,
})

const hasDiscoveryOnlySnapshotDisposition = (provider = {}) => {
  const inventoryMetadata = [
    provider.atsPlatform,
    provider.backfillMode,
    provider.extractionStrategy,
    provider.paginationStrategy,
  ].filter(Boolean).join(' ')

  return /fail-closed|sentinel|no-verified-official-careers-feed|no-enumerable|without-enumerable|without-public-listings|no-public-listings|no-public-careers|no-public-jobs|without-stable-public-feed|no-trustworthy-jobs-contract|resume-form|form-only|jobylon-shell/i.test(inventoryMetadata)
}

const hasExplicitZeroVerifiedCounts = (provider = {}) => (
  Number(provider.verifiedPublicJobCount) === 0
  && (
    provider.verifiedIndiaJobCount == null
    || Number(provider.verifiedIndiaJobCount) === 0
  )
)

const hasMissingVerifiedCounts = (provider = {}) => (
  provider.verifiedPublicJobCount == null
  && provider.verifiedIndiaJobCount == null
)

const hasLegacyDiscoveryOnlyZeroSignals = (provider = {}) => {
  const inventoryMetadata = [
    provider.atsPlatform,
    provider.backfillMode,
    provider.extractionStrategy,
    provider.paginationStrategy,
    provider.verifiedSurfaceSummary,
  ].filter(Boolean).join(' ')

  return /fail-closed|return-empty|empty-state|empty-board|no-current-openings|no-openings|no-vacanc|zero-open|no-public|without-public|without-first-party-job|without-trustworthy|no-trustworthy|no-verified|no-verifiable|unverifiable|blocked|cloudflare|403|522|unreachable|parked|parking|redirect|placeholder|coming-soon|form-only|application-form|email-only|resume|login-only|not-exact-employer|no-exact-name|not a distinct/i.test(inventoryMetadata)
}

const hasDiscoveryOnlyVerifiedCounts = (provider = {}) => (
  hasExplicitZeroVerifiedCounts(provider)
  || (
    hasMissingVerifiedCounts(provider)
    && hasLegacyDiscoveryOnlyZeroSignals(provider)
  )
)

const hasDiscoveryOnlyProviderSnapshot = (provider = {}) => (
  !hasVerifiedEmptyProviderSnapshot(provider)
  && hasDiscoveryOnlySnapshotDisposition(provider)
  && hasDiscoveryOnlyVerifiedCounts(provider)
  && Boolean(provider.verifiedOn || provider.verifiedSurfaceSummary)
)

const buildDiscoveryOnlyProviderEvidence = (provider = {}) => ({
  status: 'discovery-only',
  surface: provider.companyCareerPage,
  firstParty: Boolean(provider.companyCareerPage),
  listingComplete: false,
  pagesFetched: 1,
  reportedTotal: 0,
  indiaFacetCount: 0,
  verifiedAt: provider.verifiedOn,
  reason: provider.verifiedSurfaceSummary || `discovery-only-provider-snapshot:${provider.source}`,
})

const buildAuthorizedOrigins = (provider = {}) => {
  const configuredOrigins = provider.config?.auth?.authorizedOrigins
  if (Array.isArray(configuredOrigins) && configuredOrigins.length > 0) {
    return configuredOrigins
      .map((value) => {
        try {
          return new URL(value).origin
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  const fallbackCandidates = [
    provider.config?.auth?.tokenUrl,
    provider.config?.discovery?.listingApiUrl,
  ]

  return fallbackCandidates
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

const shouldAuthorizeRequest = (provider, requestUrl) => {
  if (provider.config?.auth?.strategy !== 'bearer-token-endpoint') return false

  try {
    return buildAuthorizedOrigins(provider).includes(new URL(requestUrl).origin)
  } catch {
    return false
  }
}

const getTokenValueFromPayload = (payload, tokenPath = 'token') =>
  String(tokenPath)
    .split('.')
    .reduce((current, key) => (current == null ? null : current[key]), payload) ?? null

const createAuthorizedFetchJson = (provider) => {
  const authConfig = provider.config?.auth || {}
  let cachedToken = null

  const fetchToken = async ({ forceRefresh = false, signal } = {}) => {
    if (!forceRefresh && cachedToken) return cachedToken

    const response = await fetch(authConfig.tokenUrl, {
      method: authConfig.tokenMethod || 'GET',
      headers: authConfig.tokenHeaders,
      body: authConfig.tokenBody,
      signal,
    })

    if (!response.ok) {
      throw buildHttpError(response, authConfig.tokenUrl)
    }

    const payload = await response.json()
    cachedToken = getTokenValueFromPayload(payload, authConfig.tokenPath || 'token')

    if (!cachedToken) {
      throw new Error(`Missing bearer token in response from ${authConfig.tokenUrl}`)
    }

    return cachedToken
  }

  return async (url, options = {}) => {
    const executeRequest = async ({ forceRefresh = false } = {}) => {
      const headers = { ...(options.headers || {}) }

      if (shouldAuthorizeRequest(provider, url)) {
        const token = await fetchToken({ forceRefresh, signal: options.signal })
        headers.Authorization = `Bearer ${token}`
      }

      return fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        signal: options.signal,
      })
    }

    let response = await executeRequest()
    let httpError = response.ok ? null : buildHttpError(response, url)
    if (
      shouldAuthorizeRequest(provider, url)
      && (response.status === 401 || response.status === 403)
    ) {
      response = await executeRequest({ forceRefresh: true })
      httpError = response.ok ? null : buildHttpError(response, url)
    }

    if (httpError) throw httpError

    return response.json()
  }
}

export const getScraperCatalog = ({
  providerExtensionDir = DEFAULT_PROVIDER_EXTENSION_DIR,
  providerExtensions = loadProviderExtensions(providerExtensionDir),
} = {}) => dedupeCatalogBySource([
  ...workdayCompanies.map((item) => ({
    ...item,
    adapter: 'workday',
  })),
  ...customProviders,
  ...providerExtensions.filter((item) => item.catalogOverride !== true),
  ...apiPortalProviders.map((item) => ({
    ...item,
    adapter: 'apiPortal',
  })),
  ...TARGETED_OPENING_PROVIDERS.map((item) => expandApiPortalProviderTemplate(item)),
  // Current source-owned catalogs supersede historical zero/sentinel notes.
  ...[FINOLEX_CATALOG,GOODNOTES_CATALOG,DENTALKART_CATALOG,DHAN_CATALOG].map(provider=>({...provider,verifiedPublicJobCount:null,verifiedIndiaJobCount:null,verifiedOn:null,backfillMode:null})),
  // Explicit, verified repairs must win over stale base adapter configuration.
  // Ordinary extensions retain their historical precedence for compatibility.
  ...providerExtensions.filter((item) => item.catalogOverride === true),
]).map((provider) => hydrateProviderCatalogEntry(provider))

const readNativeCollectionAudit = (jobs, source, observations) => {
  try {
    // Read data descriptors only: metadata accessors must never run while the
    // registry is decorating a source result.
    const audit = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')?.value
    if (!audit || typeof audit !== 'object' || Array.isArray(audit)) return null
    const prototype = Object.getPrototypeOf(audit)
    if (prototype !== Object.prototype && prototype !== null) return null
    const fields = Object.getOwnPropertyDescriptors(audit)
    if (Object.values(fields).some(field => !Object.hasOwn(field, 'value'))) return null
    if (fields.source && fields.source.value !== source) return null

    if (observations) {
      // A full audit may accompany the bounded observation snapshot, but it
      // cannot contradict that snapshot or restore rejected count metadata.
      for (const [key, value] of Object.entries(observations)) {
        if (!Object.hasOwn(fields, key)) continue
        const original = fields[key]?.value
        if (original !== value && !(value === null && original === undefined)) return null
      }
      // Plain observations keep the immutable, normalized attachment below.
      if (Object.keys(fields).every(key => Object.hasOwn(observations, key))) return null
    } else if (['recordKind', 'observedRecordCount', 'observedVacancyCount'].some(key => Object.hasOwn(fields, key))) {
      return null
    }
    return audit
  } catch {
    return null
  }
}

export const decorateJobsWithProviderMetadata = (jobs, provider) => {
  const decoratedJobs = jobs.map((job) => decorateJobWithProviderMetadata(job, provider))
  const sourceObservations = readSourceObservationEvidence(jobs, provider.source)
  if (sourceObservations) attachSourceObservationEvidence(decoratedJobs, sourceObservations)
  // The normalized attachment also supplies a summary fallback property. Keep
  // compatible source-owned records, closing holds and receipts alongside it.
  const nativeAudit = readNativeCollectionAudit(jobs, provider.source, sourceObservations)
  if (nativeAudit) Object.defineProperty(decoratedJobs, 'nativeCollectionEvidence', {
    value: nativeAudit, configurable: true,
  })
  const delegationEvidence = readInventoryDelegationEvidence(jobs)
  if (delegationEvidence) attachInventoryDelegationEvidence(decoratedJobs, delegationEvidence)
  const inventoryEvidence = readInventoryEvidence(jobs)
  if (inventoryEvidence) {
    attachInventoryEvidence(decoratedJobs, inventoryEvidence)
  } else if (decoratedJobs.length === 0 && (hasVerifiedEmptyProviderSnapshot(provider)
    || hasCompleteInventoryZeroIndiaProviderSnapshot(provider))) {
    // Catalog notes describe a past investigation, not a fetch in this attempt.
    attachInventoryEvidence(decoratedJobs, {
      status: 'unverified', surface: provider.companyCareerPage,
      firstParty: false, listingComplete: false, pagesFetched: 0,
      verifiedAt: null, reason: 'catalog-metadata-is-not-live-inventory-evidence',
    })
  } else if (decoratedJobs.length === 0 && hasDiscoveryOnlyProviderSnapshot(provider)) {
    attachInventoryEvidence(decoratedJobs, buildDiscoveryOnlyProviderEvidence(provider))
  }
  if (jobs[WORKDAY_AUTHORITATIVE_EMPTY] === true) {
    Object.defineProperty(decoratedJobs, WORKDAY_AUTHORITATIVE_EMPTY, {
      value: true,
    })
  }
  if (jobs[WORKDAY_COUNTRY_INVENTORY_PROOF]) {
    Object.defineProperty(decoratedJobs, WORKDAY_COUNTRY_INVENTORY_PROOF, {
      value: jobs[WORKDAY_COUNTRY_INVENTORY_PROOF],
    })
  }
  if (jobs[OFFICIAL_ATS_DISCOVERY]) {
    Object.defineProperty(decoratedJobs, OFFICIAL_ATS_DISCOVERY, {
      value: jobs[OFFICIAL_ATS_DISCOVERY],
    })
  }
  if (jobs[RECRUITMENT_OBSERVATIONS]) {
    Object.defineProperty(decoratedJobs, RECRUITMENT_OBSERVATIONS, {
      value: jobs[RECRUITMENT_OBSERVATIONS],
    })
  }
  return decoratedJobs
}

const createWorkdayScraper = (provider) => ({
  name: provider.source,
  dryRunFile: provider.dryRunFile,
  provider,
  run: async ({ signal, nativeDetailRecovery } = {}) => {
    const { runWorkdayScraper } = await import('../myworkday/engine.js')
    const jobs = await runWorkdayScraper({
      company: provider.companyName,
      baseUrl: provider.baseUrl,
      locationCountry: provider.locationCountry,
      source: provider.source,
      scraperDir: provider.sourceDirectory,
      boardIdentityVerified: provider.boardIdentityVerified === true,
      ...(signal === undefined ? {} : { signal }),
      ...(nativeDetailRecovery === undefined ? {} : { nativeDetailRecovery }),
    })

    return decorateJobsWithProviderMetadata(jobs, provider)
  },
})

const createScriptScraper = (provider) => ({
  name: provider.source,
  dryRunFile: provider.dryRunFile,
  provider,
  run: async (runOptions = {}) => {
    const moduleSpecifier = path.isAbsolute(provider.modulePath)
      ? pathToFileURL(provider.modulePath).href
      : provider.modulePath
    const module = await import(moduleSpecifier)
    const jobs = await module.run(runOptions)
    const { recoverEmptyOnlyRecruitment } = await import('../utils/emptyOnlyRecruitmentRecovery.js')
    const recovered = await recoverEmptyOnlyRecruitment(jobs, provider, runOptions)
    const decorated = decorateJobsWithProviderMetadata(recovered, provider)
    if (recovered.emptyOnlyRecruitmentRecovery) Object.defineProperty(decorated, 'emptyOnlyRecruitmentRecovery', {
      value: recovered.emptyOnlyRecruitmentRecovery, configurable: true,
    })
    return decorated
  },
})

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
    signal: options.signal,
  })

  if (!response.ok) {
    const error = buildHttpError(response, url)
    const retryAfter = response.headers?.get?.('retry-after')
    if (retryAfter != null) {
      error.retryAfter = retryAfter
      const retryDelayMs = error.retryDelayMs ?? parseRetryAfterHeader(retryAfter)
      if (retryDelayMs != null) error.retryDelayMs = retryDelayMs
    }
    throw error
  }

  return response.json()
}

const createApiPortalScraper = (provider) => ({
  name: provider.source,
  dryRunFile: provider.dryRunFile,
  provider,
  run: async ({ signal } = {}) => {
    const { runApiPortalScraper } = await import('../apiPortal/engine.js')
    const jobs = await runApiPortalScraper({
      provider,
      signal,
      fetchJson: provider.config?.auth?.strategy
        ? createAuthorizedFetchJson(provider)
        : fetchJson,
    })

    return decorateJobsWithProviderMetadata(jobs, provider)
  },
})

export const createPublicAtsCatalogScraper = (provider) => ({
  name: provider.source,
  provider,
  dryRunFile: provider.dryRunFile,
  async run(options = {}) {
    if (!hasMatchingPublicAtsBinding(provider)) throw new Error(`[${provider.source}] Missing matching official ATS binding`)
    const factory = provider.runtimeInventoryVerification
      ? (await import('../utils/publicAtsRuntimeInventory.js')).createRuntimeVerifiedPublicAtsScraper
      : (await import('../utils/publishingGapAts.js')).createPublishingGapAtsScraper
    const jobs = await factory(provider).run(options)
    return decorateJobsWithProviderMetadata(jobs, provider)
  },
})

const ADAPTER_FACTORIES = {
  workday: createWorkdayScraper,
  script: createScriptScraper,
  apiPortal: createApiPortalScraper,
  publicAts: createPublicAtsCatalogScraper,
}

const dedupeCatalogBySource = (providers = []) => {
  const providersBySource = new Map()

  for (const provider of providers) {
    const source = provider.source || provider.name
    if (!source) continue

    const existing = providersBySource.get(source)
    if (!existing) {
      providersBySource.set(source, provider)
      continue
    }

    providersBySource.set(source, {
      ...existing,
      ...provider,
    })
  }

  return [...providersBySource.values()]
}

export const createCatalogScraper = (provider) => {
  const factory = ADAPTER_FACTORIES[provider.adapter]
  if (!factory) throw new Error(`Unsupported scraper adapter: ${provider.adapter}`)
  return factory(provider)
}

export const buildScrapers = () => getScraperCatalog().map(createCatalogScraper)
