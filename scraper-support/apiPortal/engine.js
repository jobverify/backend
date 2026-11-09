import { createPaginationState, getNextPageRequest, updatePaginationState, hasPaginationContinuation } from './pagination.js'
import { createHash } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { traceRetryPressure, recordRetryAttempt, recordRetryFailure, recordRetryDelay } from '../utils/retryPressure.js'
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js'
import { isIndiaJob } from '../utils/indiaLocationFilter.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { fetchSmartRecruitersDetail } from './smartRecruitersDetail.js'
import { isGreenhousePublicationProvider, resolveGreenhousePublication } from './greenhousePublication.js'
import { assertEightfoldDetailIdentity } from './eightfoldDetailIdentity.js'
import { readEightfoldLocationScope } from './eightfoldLocations.js'
import { identifyPublicAtsBoard } from '../utils/publicAtsIdentity.js'
import {
  expandTemplate,
  getMappedFieldValue,
  getValueAtPath,
  normalizeApiPortalConfig,
} from './providerConfig.js'

const normalizeRequiredSkills = (value) => (
  Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : []
)

const isEmptyEightfoldError = (payload, provider) => provider.atsPlatform === 'eightfold' && payload?.status === 200
  && payload.error && !Array.isArray(payload.error) && Object.keys(payload.error).length === 2
  && payload.error.message === '' && payload.error.body === ''

const hasValueAtPath = (value, selector) => {
  for (const key of String(selector || '').split('.')) {
    if (value == null || !Object.hasOwn(Object(value), key)) return false
    value = value[key]
  }
  return true
}

const deriveCity = (location) => {
  if (!location) return null
  const normalized = String(location)
  if (/remote/i.test(normalized)) return 'Remote'
  if (/multiple locations/i.test(normalized)) return null
  return normalized.split(/[,-]/)[0]?.trim() || null
}

const toAbsoluteUrl = (value, provider) => {
  if (value == null || value === '') return null
  try {
    return new URL(value, provider.companyCareerPage).toString()
  } catch {
    return null
  }
}

const buildMynextHireLink = (selector = {}, payload = {}) => {
  const reqIdSelector = selector.reqIdPath || 'reqId'
  const reqId = getMappedFieldValue(payload, reqIdSelector)
  if (reqId == null || !selector.baseUrl) return null

  const qStringContext = {
    pageType: selector.pageType || 'jd',
    cvSource: selector.cvSource || 'careers',
    reqId,
    requester: {
      id: selector.requester?.id || '',
      code: selector.requester?.code || '',
      name: selector.requester?.name || '',
    },
    page: selector.page || 'careers',
    bufilter: selector.bufilter ?? -1,
    customFields: selector.customFields || {},
  }

  let additionalFilters = ''
  Object.entries(qStringContext.customFields).forEach(([key, value]) => {
    additionalFilters += `&${key}${encodeURIComponent('=')}${encodeURIComponent(value)}`
  })

  const encodedContext = Buffer
    .from(JSON.stringify(qStringContext), 'utf8')
    .toString('base64')

  return `${selector.baseUrl}?src${encodeURIComponent('=')}${qStringContext.cvSource}${additionalFilters}${encodeURIComponent('&')}p${encodeURIComponent('=')}${encodedContext}`
}

const getMappedValue = (payload, selector) => {
  if (!selector) return null
  if (typeof selector === 'object' && !Array.isArray(selector) && selector.strategy === 'mynexthire-link') {
    return buildMynextHireLink(selector, payload)
  }
  return getMappedFieldValue(payload, selector)
}

const serializeRequestBody = (body, headers = {}) => {
  if (body == null) return undefined
  if (typeof body === 'string' || body instanceof URLSearchParams || Buffer.isBuffer(body)) {
    return body
  }

  const contentTypeHeader = Object.entries(headers).find(([key]) => (
    String(key).toLowerCase() === 'content-type'
  ))
  const contentType = String(contentTypeHeader?.[1] || '').toLowerCase()

  if (typeof body === 'object') {
    if (!contentType || contentType.includes('application/json')) {
      return JSON.stringify(body)
    }
  }

  return body
}

const mergeRequestBody = (baseBody, pageBody) => {
  if (pageBody == null) return baseBody
  if (baseBody == null) return pageBody

  if (
    typeof baseBody === 'object'
    && !Array.isArray(baseBody)
    && typeof pageBody === 'object'
    && !Array.isArray(pageBody)
  ) {
    return {
      ...baseBody,
      ...pageBody,
    }
  }

  return pageBody
}

const matchesFieldPattern = (value, pattern) => {
  if (!pattern) return true
  if (value == null) return false

  const flags = pattern.flags || 'i'
  const source = pattern.regex || pattern.pattern || String(pattern)
  return new RegExp(source, flags).test(String(value))
}

const passesResultFilter = (mapped, resultFilter = {}) => {
  const include = Array.isArray(resultFilter.include) ? resultFilter.include : []
  const exclude = Array.isArray(resultFilter.exclude) ? resultFilter.exclude : []

  if (include.some((rule) => !matchesFieldPattern(mapped?.[rule.field], rule))) {
    return false
  }

  if (exclude.some((rule) => matchesFieldPattern(mapped?.[rule.field], rule))) {
    return false
  }

  return true
}

const mapRecord = (raw, provider, config, detail = {}, detailObservation = 'not-requested') => {
  const nativePublication = isGreenhousePublicationProvider(provider, config)
    ? resolveGreenhousePublication(raw, detail, detailObservation)
    : null
  const merged = { ...raw, ...detail }
  const eightfoldLocationScope = config.mapping.location?.strategy === 'eightfold-location'
    ? readEightfoldLocationScope(raw) : null
  const title = getMappedValue(merged, config.mapping.title)
  const location = getMappedValue(merged, config.mapping.location)
  const experienceLevel = getMappedValue(merged, config.mapping.experienceLevel)
  const postingDate = nativePublication ? nativePublication.value : getMappedValue(merged, config.mapping.postingDate)
  const remoteStatus = getMappedValue(merged, config.mapping.remoteStatus)
  const nativeCountry = config.mapping.country ? getMappedValue(merged, config.mapping.country) : null
  const sourceUrl = toAbsoluteUrl(
    getMappedValue(merged, config.mapping.sourceUrl) ?? detail.sourceUrl,
    provider,
  )
  const applyUrl = toAbsoluteUrl(
    getMappedValue(merged, config.mapping.applyUrl) ?? detail.applyUrl,
    provider,
  )
  const canonicalUrl = sourceUrl || applyUrl

  if (!title || !canonicalUrl) return null

  return {
    title,
    company: provider.companyName,
    location,
    city: deriveCity(location),
    country: config.mapping.country
      ? nativeCountry || (provider.atsPlatform === 'lever' && /\bindia\b/i.test(String(location || '')) ? 'India' : null)
      : provider.countryFilter || 'India',
    ...(eightfoldLocationScope ? {
      locations: eightfoldLocationScope.indiaLocations,
      sourceNativeLocations: eightfoldLocationScope.nativeLocations,
      sourceStandardizedLocations: eightfoldLocationScope.standardizedLocations,
    } : {}),
    link: canonicalUrl,
    applyUrl,
    sourceUrl: canonicalUrl,
    source: provider.source,
    jobId: getMappedValue(merged, config.mapping.jobId),
    requisitionId: getMappedValue(merged, config.mapping.requisitionId),
    department:
      getMappedValue(merged, config.mapping.department)
      ?? getValueAtPath(detail, 'department'),
    employmentType: getMappedValue(merged, config.mapping.employmentType),
    experienceRequired: getMappedValue(merged, config.mapping.experienceRequired),
    ...(experienceLevel != null ? { experienceLevel } : {}),
    ...(postingDate != null ? { postingDate } : {}),
    ...(nativePublication ? { nativePublication } : {}),
    jobDescription:
      getMappedValue(detail, config.detail.mapping.jobDescription)
      ?? getMappedValue(merged, config.mapping.jobDescription),
    minimumQualification:
      getMappedValue(detail, config.detail.mapping.minimumQualification)
      ?? getMappedValue(merged, config.mapping.minimumQualification),
    preferredQualification:
      getMappedValue(detail, config.detail.mapping.preferredQualification)
      ?? getMappedValue(merged, config.mapping.preferredQualification),
    requiredSkills: normalizeRequiredSkills(
      getMappedValue(detail, config.detail.mapping.requiredSkills)
      ?? getMappedValue(merged, config.mapping.requiredSkills),
    ),
    remoteStatus: remoteStatus ?? (/remote/i.test(location || '') ? 'Remote' : 'On-site'),
    scrapedAt: new Date().toISOString(),
  }
}

const createFallbackDetailUrl = (provider, record, config) => {
  const configuredSourceUrl = getMappedValue(record, config.mapping.sourceUrl)
  const configuredApplyUrl = getMappedValue(record, config.mapping.applyUrl)
  const directUrl = toAbsoluteUrl(configuredSourceUrl || configuredApplyUrl, provider)
  if (directUrl) return directUrl

  const jobId = getMappedValue(record, config.mapping.jobId)
  if (jobId && provider.atsPlatform === 'eightfold') {
    try {
      return `${new URL(config.detail.urlTemplate).origin}/careers/job/${jobId}`
    } catch {
      return null
    }
  }

  const detailUrl = expandTemplate(config.detail.urlTemplate, {
    jobId,
    requisitionId: getMappedValue(record, config.mapping.requisitionId),
  })

  return toAbsoluteUrl(detailUrl, provider)
}

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const workerCount = Math.max(1, Math.min(
    items.length || 1,
    Number.isFinite(concurrency) ? Math.floor(concurrency) : 1,
  ))
  const results = new Array(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

const validateInventory = (payload, records, rules) => {
  if (!rules) return
  if (!Array.isArray(records) || records.length < (rules.minRecords ?? 0)) {
    throw new Error('API portal inventory validation failed: missing or short listing array')
  }
  if (
    rules.totalCountPath
    && getValueAtPath(payload, rules.totalCountPath) !== records.length
  ) {
    throw new Error('API portal inventory validation failed: total count mismatch')
  }
  if (
    rules.sourcePath
    && getValueAtPath(payload, rules.sourcePath) !== rules.expectedSource
  ) {
    throw new Error('API portal inventory validation failed: source marker mismatch')
  }

  const seen = new Set()
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      throw new Error('API portal inventory validation failed: malformed listing')
    }
    for (const field of rules.requiredFields || []) {
      const value = getValueAtPath(record, field)
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`API portal inventory validation failed: missing ${field}`)
      }
    }
    if (rules.uniqueField) {
      const value = getValueAtPath(record, rules.uniqueField)
      if (seen.has(value)) {
        throw new Error('API portal inventory validation failed: duplicate listing ID')
      }
      seen.add(value)
    }
    if (rules.urlField) {
      try {
        const url = new URL(getValueAtPath(record, rules.urlField))
        if (
          url.origin !== rules.allowedUrlOrigin
          || !url.pathname.startsWith(rules.urlPathPrefix)
        ) {
          throw new Error('untrusted URL')
        }
      } catch {
        throw new Error('API portal inventory validation failed: untrusted listing URL')
      }
    }
  }
}

export const runApiPortalScraper = async ({ provider, fetchJson, fetchBrowserJson, signal, fetchImpl, now, maxJobs }) => {
  signal?.throwIfAborted()
  if (provider.nativeCurrentCareerSurface !== undefined) {
    const {runCurrentSlbCareers,SLB_CURRENT_SURFACE}=await import('./slbCurrentCareers.js')
    if(provider.nativeCurrentCareerSurface!==SLB_CURRENT_SURFACE)throw Error('Unsupported current native company careers surface')
    return runCurrentSlbCareers({provider,fetchImpl,signal,now,maxJobs})
  }
  const config = normalizeApiPortalConfig(provider.config || {})
  const traversalMode = config.pagination.traversalMode
  if (traversalMode != null && !['interleaved', 'staged-snapshot'].includes(traversalMode)) {
    throw Object.assign(new Error('API portal traversalMode must be interleaved or staged-snapshot'), { abortRetries: true })
  }
  const stagedTraversal = traversalMode === 'staged-snapshot'
  const publicAccessRecovery = provider.publicAccessPolicy === 'preserve-verified-stop-denied-origin'
  if (provider.publicAccessPolicy !== undefined && (!publicAccessRecovery || provider.atsPlatform !== 'eightfold'
    || config.detail.enabled !== true || config.detail.requireListingIdentity !== true)) {
    throw Object.assign(new Error('API portal public access recovery requires verified Eightfold detail identities'), { abortRetries: true })
  }
  const deniedOrigins = new Map(), verifiedPublicJobs = new Set()
  const denialStatus = error => {
    const seen = new Set()
    for (let current = error; current && !seen.has(current); current = current.cause) {
      seen.add(current)
      if ([401, 403, 429, 451].includes(Number(current.status))) return Number(current.status)
    }
    return null
  }
  const maxPages = Number(config.pagination.maxPages ?? 1000)
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error('API portal inventory requires a positive page limit')
  if (
    provider.atsPlatform === 'eightfold'
    && config.pagination?.strategy === 'offset-limit'
    && config.pagination.pageSize == null
  ) {
    config.pagination = { ...config.pagination, pageSize: provider.templateOptions?.pageSize ?? 50 }
  }
  const maximumTimerDelayMs = 2147483647
  const policy = config.rateLimit
  const policyNumber = (name, fallback) => {
    const value = Number(policy[name] ?? fallback)
    if (!Number.isSafeInteger(value) || value < 0 || name !== 'maxRetries' && value > maximumTimerDelayMs) {
      throw Object.assign(new Error(`API portal rate limit ${name} must be a bounded nonnegative integer`), { abortRetries: true })
    }
    return value
  }
  const rateLimit = policy ? {
    minimumIntervalMs: policyNumber('minimumIntervalMs', 0),
    maxRetries: policyNumber('maxRetries', 0),
    baseDelayMs: policyNumber('baseDelayMs', 2000),
    maxDelayMs: policyNumber('maxDelayMs', 30000),
  } : null
  const pacingController = rateLimit ? new AbortController() : null
  const exhaustPortalRetries = error => {
    Object.assign(error, { abortRetries: true })
    pacingController.abort(error)
    return error
  }
  let lastRequestStartedAt = null, cooldownUntil = 0, slotQueue = Promise.resolve()
  const requestJson = async (url, options = {}) => {
    signal?.throwIfAborted()
    const requestSignal = AbortSignal.any([...(signal ? [signal] : []), ...(options.signal ? [options.signal] : []), AbortSignal.timeout(20000)])
    try {
      const result = await fetchJson(url, { ...options, signal: requestSignal })
      requestSignal.throwIfAborted()
      return result
    } catch (error) {
      signal?.throwIfAborted()
      throw error
    }
  }
  const wait = async (ms, waitSignal = signal) => {
    try { await sleep(ms, undefined, { signal: waitSignal }) }
    catch (error) { waitSignal?.throwIfAborted(); throw error }
  }
  const reserveRequestSlot = requestSignal => {
    // Serialize only slot reservation. Requests can remain in flight together,
    // but workers cannot awaken from the same wait and start as one burst.
    const slot = slotQueue.then(async () => {
      while (true) {
        requestSignal?.throwIfAborted()
        const earliestStart = Math.max(cooldownUntil, lastRequestStartedAt == null ? 0 : lastRequestStartedAt + rateLimit.minimumIntervalMs)
        const remaining = earliestStart - Date.now()
        if (remaining <= 0) break
        await wait(remaining, requestSignal)
        // A peer may receive Retry-After while this slot is waiting.
      }
      requestSignal?.throwIfAborted()
      lastRequestStartedAt = Date.now()
    })
    slotQueue = slot.catch(() => {})
    return slot
  }
  const fetchPortalJson = (url, options = {}) => traceRetryPressure(async () => {
    const origin = new URL(url).origin
    if (publicAccessRecovery && deniedOrigins.has(origin)) {
      signal?.throwIfAborted()
      throw deniedOrigins.get(origin)
    }
    const requestSignal = signal && options.signal ? AbortSignal.any([signal, options.signal]) : signal || options.signal
    const pacingSignal = rateLimit ? AbortSignal.any([pacingController.signal, ...(requestSignal ? [requestSignal] : [])]) : requestSignal
    for (let attempt = 0; ; attempt += 1) {
      if (rateLimit) await reserveRequestSlot(pacingSignal)
      requestSignal?.throwIfAborted()
      if (publicAccessRecovery && deniedOrigins.has(origin)) throw deniedOrigins.get(origin)
      recordRetryAttempt(attempt + 1)
      try {
        return await requestJson(url, options)
      } catch (error) {
        recordRetryFailure()
        requestSignal?.throwIfAborted()
        if (publicAccessRecovery && denialStatus(error)) {
          error.abortRetries = true
          deniedOrigins.set(origin, error)
          throw error
        }
        if (!rateLimit || !(/HTTP 429\b/i.test(String(error?.message)) || error?.status === 429)) {
          if (publicAccessRecovery && denialStatus(error)) deniedOrigins.set(origin, error)
          throw error
        }
        if (error?.abortRetries === true || attempt >= rateLimit.maxRetries) {
          if (publicAccessRecovery) deniedOrigins.set(origin, error)
          throw exhaustPortalRetries(error)
        }
        const backoffMs = Math.min(
          rateLimit.maxDelayMs,
          rateLimit.baseDelayMs * (2 ** Math.min(attempt, 31)),
        )
        const retryAfterMs = error.retryDelayMs == null ? 0 : Math.ceil(Number(error.retryDelayMs))
        const delayMs = Math.max(backoffMs, retryAfterMs)
        // Never shorten a server delay or let an oversized timeout wrap to 1 ms.
        if (!Number.isSafeInteger(delayMs) || delayMs > maximumTimerDelayMs) {
          if (publicAccessRecovery) deniedOrigins.set(origin, error)
          throw exhaustPortalRetries(error)
        }
        cooldownUntil = Math.max(cooldownUntil, Date.now() + delayMs)
        recordRetryDelay(delayMs)
      }
    }
  })
  const jobs = []
  let state = createPaginationState(config.pagination)
  let pagesFetched = 0
  let recordsFetched = 0
  let reportedTotal = null
  let inventoryComplete = true
  let indiaCount = 0
  let continuation = false
  const seenIdentities = new Set()
  const incompleteReasons = new Set()
  const markIncomplete = reason => { inventoryComplete = false; incompleteReasons.add(reason) }

  let stagedDeadline = null, stagedDeadlineController, stagedDeadlineReason, stagedDeadlineTimer
  if (stagedTraversal) {
    const budget = provider.scraperTimeoutMs ?? 300000
    if (!Number.isSafeInteger(budget) || budget < 1 || budget > 1800000) {
      throw Object.assign(new Error('API portal staged source deadline must be within 30 minutes'), { abortRetries: true })
    }
    stagedDeadlineController = new AbortController()
    stagedDeadlineReason = new DOMException('API portal staged source deadline exceeded', 'TimeoutError')
    signal = signal ? AbortSignal.any([signal, stagedDeadlineController.signal]) : stagedDeadlineController.signal
    stagedDeadline = performance.now() + budget
    stagedDeadlineTimer = setTimeout(() => stagedDeadlineController.abort(stagedDeadlineReason), budget)
  }
  const checkTraversalAbort = () => {
    signal?.throwIfAborted()
    if (stagedDeadline != null && performance.now() >= stagedDeadline) stagedDeadlineController.abort(stagedDeadlineReason)
    signal?.throwIfAborted()
  }
  const hydrateRecords = async listingRecords => {
    checkTraversalAbort()
    const mappedRecords = await mapWithConcurrency(
      listingRecords,
      config.detail.enabled ? (config.detail.concurrency || 1) : 1,
      async (record) => {
        checkTraversalAbort()
        // Reconcile the full feed above, but only hydrate explicitly selected
        // public records. Draft/private records are not missing job details.
        if (config.recordFilter && !passesResultFilter(record, config.recordFilter)) return null
        if (config.mapping.location?.strategy === 'eightfold-location' && !record.locations.length) {
          markIncomplete('native-location-scope-unresolved')
          return null
        }
        let detailPayload = {}
        let detailObservation = 'not-requested'

        if (config.detail.enabled) {
          const detailUrl = expandTemplate(config.detail.urlTemplate, {
            jobId: getMappedValue(record, config.mapping.jobId),
            requisitionId: getMappedValue(record, config.mapping.requisitionId),
          })

          try {
            detailPayload = config.detail.strategy === 'smartrecruiters-public-posting'
              ? await fetchSmartRecruitersDetail({
                publicUrl: getMappedValue(record, config.detail.publicUrlPath || config.mapping.applyUrl),
                expectedCompany: config.detail.expectedCompany,
                expectedCountry: config.detail.expectedCountry,
                expectedLocation: getMappedValue(record, config.detail.locationPath || config.mapping.location),
                fetchJson: fetchPortalJson,
              })
              : await fetchPortalJson(detailUrl, {
              method: config.detail.method,
              headers: config.detail.headers,
              body: serializeRequestBody(config.detail.body, config.detail.headers),
            })
            if (!detailPayload || typeof detailPayload !== 'object' || detailPayload.success === false
              || (detailPayload.error && !isEmptyEightfoldError(detailPayload, provider)) || (Array.isArray(detailPayload.errors) && detailPayload.errors.length)) {
              throw new Error('API portal detail contract failed: upstream error response')
            }
            if (config.detail.requireListingIdentity === true) assertEightfoldDetailIdentity(record, detailPayload, provider)
            if (config.detail.mapping.jobDescription && !hasSourceDescription({
              jobDescription: getMappedValue(detailPayload, config.detail.mapping.jobDescription),
            })) throw new Error('API portal detail contract incomplete: missing employer description')
            detailObservation = 'observed'
          } catch (error) {
            signal?.throwIfAborted()
            if (config.detail.required || error.incompleteScope === true) throw error
            markIncomplete('optional-role-details-unavailable')
            detailObservation = 'failed'

            detailPayload = {
              sourceUrl: createFallbackDetailUrl(provider, record, config),
              applyUrl: createFallbackDetailUrl(provider, record, config),
              detailFetchError: error.message,
            }
          }
        }

        const mapped = mapRecord(record, provider, config, detailPayload, detailObservation)
        if (publicAccessRecovery && mapped && detailObservation === 'observed'
          && typeof mapped.jobDescription === 'string' && mapped.jobDescription.length >= 150) {
          const location = readEightfoldLocationScope(record)
          if (!location.unresolved && location.indiaLocations.length && isIndiaJob(mapped)) verifiedPublicJobs.add(mapped)
        }
        if (!mapped) markIncomplete('unmappable-listing')
        if (mapped) {
          const identity = mapped.jobId ?? mapped.requisitionId ?? mapped.sourceUrl
          if (identity != null) {
            const key = String(identity)
            if (seenIdentities.has(key)) markIncomplete('repeated-vacancy-identity')
            seenIdentities.add(key)
          }
          const needsIndiaDetails = provider.atsPlatform !== 'lever'
            || (isIndiaJob(mapped) && passesResultFilter(mapped, config.resultFilter))
          if (needsIndiaDetails && !hasSourceDescription(mapped)) {
            if (config.detail.enabled && config.detail.required) throw new Error('API portal detail contract incomplete: missing employer description')
            markIncomplete('employer-description-unavailable')
          }
        }
        if (mapped && isIndiaJob(mapped)) indiaCount += 1
        return mapped && passesResultFilter(mapped, config.resultFilter) ? mapped : null
      },
    )

    for (const mapped of mappedRecords) {
      if (mapped) jobs.push(mapped)
    }

  }
  const traverseListing = async hydrateOnPage => {
    let state = createPaginationState(config.pagination), cohortPagesFetched = 0
    let recordsFetched = 0, reportedTotal = null, continuation = false
    const seenPages = new Set(), cohortRecords = []
    while (true) {
      checkTraversalAbort()
      const nextPage = getNextPageRequest(config, state)
      if (!nextPage) break
      if (cohortPagesFetched >= maxPages) throw new Error('API portal inventory incomplete: page limit reached')

      const url = new URL(config.discovery.listingApiUrl)
      Object.entries(config.request.query || {}).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
      Object.entries(nextPage.query || {}).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })

      let listingPayload
      try {
        listingPayload = await fetchPortalJson(url.toString(), {
          method: config.request.method,
          headers: config.request.headers,
          body: serializeRequestBody(
            mergeRequestBody(config.request.body, nextPage.body),
            config.request.headers,
          ),
        })
      } catch (error) {
        checkTraversalAbort()
        if (!publicAccessRecovery || stagedTraversal || !denialStatus(error) || cohortPagesFetched < 1
          || !jobs.some(job => verifiedPublicJobs.has(job))) throw error
        // A later denial cannot erase full native details already bound to an
        // exact employer role. Stop this origin and keep only those proofs.
        const retained = jobs.filter(job => verifiedPublicJobs.has(job))
        jobs.splice(0, jobs.length, ...retained)
        markIncomplete(`native-listing-access-denied-http${denialStatus(error)}`)
        break
      }
      checkTraversalAbort()
      const records = getValueAtPath(listingPayload, config.pagination.resultsPath)
      // Eightfold includes this exact blank error object in successful search
      // responses. Populated, unknown and non-success envelopes still fail.
      const emptyEightfoldError = isEmptyEightfoldError(listingPayload, provider)
      if (listingPayload?.success === false || (listingPayload?.error && !emptyEightfoldError)
        || (Array.isArray(listingPayload?.errors) && listingPayload.errors.length > 0)) {
        throw new Error('API portal inventory validation failed: upstream error response')
      }
      if (!Array.isArray(records) || records.some(record => !record || typeof record !== 'object' || Array.isArray(record))) {
        throw new Error('API portal inventory validation failed: listing array missing or malformed')
      }
      validateInventory(listingPayload, records, config.inventoryValidation)
      if (provider.atsPlatform === 'lever') {
        const board = identifyPublicAtsBoard(config.discovery.listingApiUrl)
        if (board?.atsPlatform !== 'lever') throw new Error('Invalid Lever native board identity')
        // The wrapper also uses this engine. Import its native validator only
        // after module initialization, as in the shared Ashby factory.
        const { validatePublicPostingScope } = await import('../utils/publishingGapAts.js')
        for (const reason of validatePublicPostingScope(records, 'lever', { ...provider, boardToken: board.boardToken, leverRegion: board.region || 'global' })) markIncomplete(reason)
      }
      const listingRecords = records
      if (stagedTraversal) cohortRecords.push(...listingRecords)
      if (config.mapping.location?.strategy === 'eightfold-location') {
        if (listingRecords.some(record => readEightfoldLocationScope(record).unresolved)) markIncomplete('native-location-scope-unresolved')
      }
      cohortPagesFetched += 1
      pagesFetched += 1
      if (listingRecords.length) {
        const fingerprint = createHash('sha256').update(JSON.stringify(listingRecords)).digest('hex')
        if (seenPages.has(fingerprint)) throw new Error('API portal inventory incomplete: repeated page')
        seenPages.add(fingerprint)
      }
      recordsFetched += listingRecords.length
      const rawTotal = config.pagination.totalCountPath ? getValueAtPath(listingPayload, config.pagination.totalCountPath) : null
      if (config.pagination.totalCountPath && rawTotal == null) markIncomplete('configured-total-unavailable')
      const totalCount = rawTotal == null ? null : Number(rawTotal)
      if (rawTotal != null && (!['number', 'string'].includes(typeof rawTotal) || String(rawTotal).trim() === ''
        || !Number.isSafeInteger(totalCount) || totalCount < 0)) throw new Error('API portal inventory validation failed: malformed total count')
      if (totalCount != null) {
        if (reportedTotal != null && reportedTotal !== totalCount) markIncomplete('upstream-total-changed')
        reportedTotal = totalCount
        if (listingRecords.length === 0 && recordsFetched < totalCount) throw new Error('API portal inventory incomplete: empty page contradicts total count')
      }

      if (hydrateOnPage) await hydrateRecords(listingRecords)

      const hasMore = config.pagination.hasMorePath
        ? getValueAtPath(listingPayload, config.pagination.hasMorePath)
        : null
      if (config.pagination.hasMorePath && (hasMore == null)
        && !(config.pagination.nullHasMoreIsTerminal === true && hasValueAtPath(listingPayload, config.pagination.hasMorePath))) {
        markIncomplete('configured-continuation-unavailable')
      }
      continuation = hasPaginationContinuation(hasMore)

      state = updatePaginationState(config.pagination, state, {
        hasMore,
        totalCount,
        resultCount: Array.isArray(listingRecords) ? listingRecords.length : 0,
        // Some Eightfold hosts cap search responses below the requested limit.
        // Advance over fetched rows so the next request cannot skip vacancies.
        pageSize: provider.atsPlatform === 'eightfold' && config.pagination.strategy === 'offset-limit' && listingRecords.length > 0
          ? listingRecords.length : config.pagination.pageSize,
      })
    }
    checkTraversalAbort()
    return { state, recordsFetched, reportedTotal, continuation, records: cohortRecords, pagesFetched: cohortPagesFetched }
  }
  const canonicalRecord = record => JSON.stringify(record, (_, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)
  const snapshotIdentities = (snapshot, phase) => {
    const identities = new Map()
    for (const record of snapshot.records) {
      const value = getMappedValue(record, config.mapping.jobId) ?? getMappedValue(record, config.mapping.requisitionId)
        ?? toAbsoluteUrl(getMappedValue(record, config.mapping.sourceUrl) || getMappedValue(record, config.mapping.applyUrl), provider)
      if (!(typeof value === 'string' && value.trim() || typeof value === 'number' && Number.isSafeInteger(value))) {
        markIncomplete(phase + '-vacancy-identity-unavailable'); continue
      }
      const key = String(value)
      if (identities.has(key)) markIncomplete(phase + '-repeated-vacancy-identity')
      identities.set(key, canonicalRecord(record))
    }
    return identities
  }

  try {
    const opening = await traverseListing(!stagedTraversal)
    state = opening.state; recordsFetched = opening.recordsFetched; reportedTotal = opening.reportedTotal; continuation = opening.continuation
    if (stagedTraversal) {
      // Capture the opening raw records before hydration. No field is ignored:
      // order may change, but native IDs, locations, dates, URLs and all other
      // record values must reconcile with an independent complete closing pass.
      const openingIdentities = snapshotIdentities(opening, 'opening')
      await hydrateRecords(opening.records)
      checkTraversalAbort()
      try {
        const closing = await traverseListing(false), closingIdentities = snapshotIdentities(closing, 'closing')
        if (closing.reportedTotal !== opening.reportedTotal) markIncomplete('closing-total-changed')
        if (!closing.state.done || closing.continuation || closing.reportedTotal != null && closing.reportedTotal !== closing.recordsFetched) markIncomplete('closing-inventory-incomplete')
        if (openingIdentities.size !== closingIdentities.size || [...openingIdentities.keys()].some(key => !closingIdentities.has(key))) {
          markIncomplete('closing-vacancy-identities-changed')
        }
        if ([...openingIdentities].some(([key, value]) => closingIdentities.has(key) && closingIdentities.get(key) !== value)) markIncomplete('closing-vacancy-record-changed')
      } catch (error) {
        checkTraversalAbort()
        // Closing failure cannot erase already validated opening vacancies.
        markIncomplete('closing-inventory-unavailable')
      }
    }


    checkTraversalAbort()
    if (publicAccessRecovery && deniedOrigins.size) {
      const retained = jobs.filter(job => verifiedPublicJobs.has(job))
      if (!retained.length) throw deniedOrigins.values().next().value
      jobs.splice(0, jobs.length, ...retained)
      markIncomplete('native-access-denied-unconsumed-inventory')
    }
    const complete = inventoryComplete && state.done && !continuation
      && (reportedTotal == null || reportedTotal === recordsFetched)
    if (!complete) for (const job of jobs) {
      job.sourceListingComplete = false
      if (publicAccessRecovery) { job.sourceScopeComplete = false; job.lifecycleCleanupAllowed = false }
    }
    return attachInventoryEvidence(jobs, {
      status: complete ? recordsFetched === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
      surface: config.discovery.listingApiUrl, firstParty: true, listingComplete: complete,
      pagesFetched, reportedTotal,
      indiaFacetCount: incompleteReasons.has('native-location-scope-unresolved')
        || incompleteReasons.has('native-india-location-unmapped') || deniedOrigins.size ? null : indiaCount,
      verifiedAt: new Date().toISOString(),
      reason: complete ? stagedTraversal ? 'api-portal-complete-opening-and-closing-native-pagination' : 'api-portal-complete-native-pagination'
        : `api-portal-incomplete-listing-or-role-details:${[...incompleteReasons,
          ...(!state.done || continuation ? ['unconsumed-continuation'] : []),
          ...(reportedTotal != null && reportedTotal !== recordsFetched ? ['upstream-count-mismatch'] : []),
        ].sort().join(',')}`,
    })
  } catch (error) {
    // A staged cohort can be much larger than one page. Stop peer workers on
    // a terminal opening/hydration failure rather than draining its queue.
    stagedDeadlineController?.abort(error)
    throw error
  } finally {
    clearTimeout(stagedDeadlineTimer)
  }
}
