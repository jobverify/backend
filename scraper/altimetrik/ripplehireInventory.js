import { decodeHTML } from 'entities'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

// These are the headers used by the published Backbone public careers client.
// XML negotiation serializes a partial response followed by an upstream error.
const NATIVE_HEADERS = Object.freeze({
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
})
const text = value => typeof value === 'string' ? decodeHTML(value).replace(/\s+/g, ' ').trim() || null : null
const id = value => (typeof value === 'string' || typeof value === 'number') && /^\d+$/.test(String(value)) ? String(value) : null
const descriptionText = value => typeof value === 'string' ? decodeHTML(value
  .replace(/<!--[^]*?-->/g, '')
  .replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<\/?[a-z][\w:-]*(?:\s+[^<>]*?)?\s*\/?>/gi, ' '))
  .replace(/[\t \u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim() : ''
const hasVisibleRoleCriteria = (html, title) => {
  let visible
  try { visible = extractActiveDescription(html) } catch { return false }
  if (!visible || visible.length < 60
    || /^(?:(?:an unexpected error occurred|access denied|please enable javascript|job (?:not found|unavailable)|something went wrong|enter\s+(?:the\s+)?job\s+description)[\s.!:;-]*)+$/i.test(visible)) return false
  const key = value => decodeHTML(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const titleKey = key(title), contentKey = key(visible)
  return !titleKey || !contentKey.split(titleKey).every(part => part.trim() === '')
}
const check = signal => { if (signal?.aborted) throw signal.reason }
const readWithSignal = (operation, signal, cancel) => new Promise((resolve, reject) => {
  let finished = false
  const finish = (callback, value) => {
    if (finished) return
    finished = true
    signal?.removeEventListener('abort', abort)
    callback(value)
  }
  const abort = () => {
    try { Promise.resolve(cancel?.()).catch(() => {}) } catch {}
    finish(reject, signal.reason)
  }
  if (signal?.aborted) { abort(); return }
  signal?.addEventListener('abort', abort, { once: true })
  Promise.resolve().then(() => { check(signal); return operation() }).then(
    value => signal?.aborted ? abort() : finish(resolve, value),
    error => signal?.aborted ? abort() : finish(reject, error),
  )
})
const defaultFetchText = async (url, options, consumeBytes) => {
  let response
  let reader
  let cancelled = false
  const cancel = () => {
    if (!response || cancelled) return
    cancelled = true
    try { Promise.resolve(reader ? reader.cancel(options.signal.reason) : response.body?.cancel()).catch(() => {}) } catch {}
  }
  try {
    response = await readWithSignal(async () => {
      response = await fetch(url, { ...options, redirect: 'error', credentials: 'omit' })
      if (options.signal.aborted) cancel()
      return response
    }, options.signal, cancel)
    check(options.signal)
    if (response.status !== 200) throw new Error(`RippleHire HTTP ${response.status}`)
    if (!/^application\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error('RippleHire native response is not JSON')
    if (typeof response.body?.getReader !== 'function') {
      const body = await readWithSignal(() => response.text(), options.signal, cancel)
      check(options.signal)
      if (typeof body !== 'string') throw new TypeError('Invalid native text body')
      consumeBytes(Buffer.byteLength(body), 0)
      return body
    }
    reader = response.body.getReader()
    const chunks = []
    let responseBytes = 0
    while (true) {
      const item = await readWithSignal(() => reader.read(), options.signal, cancel)
      check(options.signal)
      if (item?.done === true) break
      if (item?.done !== false || !(item.value instanceof Uint8Array)) throw new TypeError('Invalid native response byte chunk')
      consumeBytes(item.value.byteLength, responseBytes)
      responseBytes += item.value.byteLength
      chunks.push(Buffer.from(item.value))
    }
    return Buffer.concat(chunks, responseBytes).toString('utf8')
  } catch (error) { cancel(); throw error }
  finally { try { reader?.releaseLock() } catch {} }
}
const jsonObject = (body, stage) => {
  if (typeof body !== 'string') throw new Error(`Invalid native ${stage} JSON body`)
  let value
  try { value = JSON.parse(body) } catch { throw new Error(`Invalid native ${stage} JSON response`) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid native ${stage} JSON object`)
  if (['error','errorMessage','exception'].some(key => value[key] != null && value[key] !== '' && value[key] !== false)
    || Array.isArray(value.errors) && value.errors.length > 0
    || value.errorStatus != null && value.errorStatus !== 'success'
    || typeof value.message === 'string' && /^(?:an unexpected error occurred|something went wrong)[.!]*$/i.test(value.message.trim())) throw new Error(`Upstream native ${stage} JSON error envelope`)
  return value
}
const limit = (value, name) => {
  if (value === undefined || value === 0 || value === Infinity) return Infinity
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`Invalid native ${name} limit`)
  return value
}
const positive = (value, name, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new TypeError(`Invalid native ${name}`)
  return value
}
const countryFromListing = listing => {
  const value = text(listing.jobLocation)
  if (/^(?:India|IND|IN)$/i.test(value || '')) return 'India'
  if (/^(?:United States|USA|US|Canada|Mexico|United Kingdom|UK|Germany|Singapore|Australia|Japan|France|Netherlands|Poland|United Arab Emirates|UAE|Brazil|Ireland|Spain|Portugal)$/i.test(value || '')) return value
  return null
}

/** Reconciles this published native board, without asserting employer-wide scope. */
export const createRipplehireInventoryScraper = ({ source, company, origin, token, parentCompanyId,
  normalizeEmploymentType = () => 'Full-time', extractSkills, countryResolver, companyDomains = [], companyIds = [], companyCodes = [], searchParameters = {} } = {}) => ({
  async run(options = {}) {
    const { signal } = options
    check(signal)
    if (!searchParameters || typeof searchParameters !== 'object' || Array.isArray(searchParameters)) throw new TypeError('Invalid native query parameters')
    const query = {}
    for (const key of Object.keys(searchParameters)) {
      const field = Object.getOwnPropertyDescriptor(searchParameters, key)
      if (!['geo','location','state','exp','department','bu','businessunit','acc','function','level','emptype','campaignSeq'].includes(key)
        || !field || !Object.hasOwn(field, 'value') || (field.value !== undefined && typeof field.value !== 'string')) throw new TypeError('Invalid or reserved native query parameter')
      query[key] = field.value
    }
    const fetchText = options.fetchText === undefined ? defaultFetchText : options.fetchText
    if (typeof fetchText !== 'function') throw new TypeError('Invalid native fetchText reader')
    const pageSize = positive(options.pageSize ?? 10, 'page size', 100)
    const detailConcurrency = positive(options.detailConcurrency ?? 6, 'detail concurrency', 10)
    const requestTimeoutMs = positive(options.requestTimeoutMs ?? 20000, 'request timeout', 2147483647)
    const collectionBudgetMs = options.collectionBudgetMs === 0 ? 0 : positive(options.collectionBudgetMs ?? 300000, 'collection budget', 2147483647)
    const maxResponseBytes = positive(options.maxResponseBytes === undefined ? 4 * 1024 * 1024 : options.maxResponseBytes, 'response byte limit')
    const maxTotalBytes = positive(options.maxTotalBytes === undefined ? 16 * 1024 * 1024 : options.maxTotalBytes, 'aggregate byte limit')
    const maxPages = limit(options.maxPages, 'maxPages'), maxJobs = limit(options.maxJobs, 'maxJobs')
    const stopped = new AbortController()
    const activeSignal = signal ? AbortSignal.any([signal, stopped.signal]) : stopped.signal
    const queryFragment = Object.entries(query).filter(([,value]) => value !== undefined).map(([key,value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')
    const surface = `${origin}/candidate/?token=${token}&source=CAREERSITE#list${queryFragment ? `/${queryFragment}` : ''}`
    let pagesFetched = 0
    let totalResponseBytes = 0
    let opening
    let observedTotal = null
    const observedOpeningRows = []
    const nativeRoles = []
    const failures = []
    let detailAttempts = 0
    let completedInventory
    const evidence = reason => ({ status: 'coverage-gap', surface, firstParty: true, listingComplete: false,
      pagesFetched, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(), reason })
    const gap = message => Object.assign(new Error(`${company} ${message}`), { abortRetries: true, softFailure: true,
      failureKind: 'coverage_gap', partial: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    const budgetReason = gap('native collection budget exhausted')
    const byteBudget = () => Object.freeze({ maxResponseBytes, maxTotalBytes, readBytes: totalResponseBytes })
    const consumeBytes = (bytes, responseBytes) => {
      if (!Number.isSafeInteger(bytes) || bytes < 0) throw new TypeError('Invalid native byte chunk length')
      if (bytes > maxResponseBytes - responseBytes || bytes > maxTotalBytes - totalResponseBytes) {
        const error = Object.assign(gap(`native ${bytes > maxResponseBytes - responseBytes ? 'response' : 'aggregate'} byte budget exhausted`), { code: 'RIPPLEHIRE_BODY_BYTE_LIMIT' })
        stopped.abort(error)
        throw error
      }
      totalResponseBytes += bytes
    }
    const timer = setTimeout(() => stopped.abort(budgetReason), collectionBudgetMs)
    if (collectionBudgetMs === 0) stopped.abort(budgetReason)
    const request = async (url, options = {}) => {
      check(activeSignal)
      const timeout = new AbortController()
      const requestSignal = AbortSignal.any([activeSignal, timeout.signal])
      const requestTimer = setTimeout(() => timeout.abort(gap('native request timeout')), requestTimeoutMs)
      try {
        return await readWithSignal(async () => {
          const nativeOptions = { ...options, headers: { ...NATIVE_HEADERS, ...(options.headers || {}) }, signal: requestSignal }
          const body = await (fetchText === defaultFetchText ? defaultFetchText(url, nativeOptions, consumeBytes) : fetchText(url, nativeOptions))
          check(requestSignal)
          if (fetchText !== defaultFetchText) {
            if (typeof body !== 'string') throw new TypeError('Invalid native text reader body')
            consumeBytes(Buffer.byteLength(body), 0)
          }
          return body
        }, requestSignal)
      } finally { clearTimeout(requestTimer) }
    }
    const detailUrl = jobId => `${origin}/candidate/candidatejobdetail?${new URLSearchParams({ token, jobSeq: jobId, source: 'CAREERSITE', lang: 'en' })}`
    const roleUrl = (jobId, action) => `${origin}/candidate/?token=${token}&source=CAREERSITE#${action}/job/${jobId}`
    const collect = async expectedTotal => {
      const listings = [], seen = new Set()
      let total = expectedTotal ?? null
      for (let page = 0; page === 0 || page * pageSize < total; page++) {
        check(activeSignal)
        if (page >= maxPages) throw gap('native maxPages limit leaves an incomplete inventory')
        const body = new URLSearchParams({ careerSiteUrlParams: JSON.stringify({ page, search: '*:*', campaignSeq: '', token, source: 'CAREERSITE', pagesize: pageSize, ...query }), lang: 'en' })
        const value = jsonObject(await request(`${origin}/candidate/candidatejobsearch`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body }), 'listing')
        pagesFetched++
        if (value.errorStatus !== 'success' || !Number.isSafeInteger(value.totalJobCount) || value.totalJobCount < 0
          || value.totalJobCount > 100000 || value.startJobIndex !== page * pageSize || value.maxJobSize !== pageSize
          || (total !== null && value.totalJobCount !== total) || !Array.isArray(value.jobVoList)) throw gap('incomplete or changed native listing summary')
        total = value.totalJobCount
        if (expectedTotal === undefined) {
          observedTotal = total
          observedOpeningRows.push(...value.jobVoList)
        }
        if (value.jobVoList.length !== Math.min(pageSize, total - page * pageSize)) throw gap('incomplete native listing page')
        for (const row of value.jobVoList) {
          const jobId = id(row?.jobSeq), title = text(row?.jobTitle)
          if (!jobId || !title || seen.has(jobId)) throw gap('invalid or duplicate native listing identity')
          seen.add(jobId)
          listings.push({ jobId, title, raw: row, country: countryFromListing(row) })
        }
        if (total > maxJobs) throw gap('native maxJobs limit leaves an incomplete inventory')
      }
      if (listings.length !== total) throw gap('incomplete native listing snapshot')
      return { total, listings }
    }
    try {
      opening = await collect()
      const listings = opening.listings
      const jobs = new Array(listings.length)
      let cursor = 0
      const worker = async () => {
        while (cursor < listings.length) {
          check(activeSignal)
          const index = cursor++, listing = listings[index]
          detailAttempts++
          let native
          try { native = jsonObject(await request(detailUrl(listing.jobId)), 'detail') } catch (error) {
            check(activeSignal)
            failures.push(Object.freeze({ stage: 'native-detail', jobId: listing.jobId, failureKind: 'native-detail-transport-or-json' }))
            nativeRoles[index] = Object.freeze({ jobId: listing.jobId, title: listing.title, country: listing.country,
              rawListingCountry: text(listing.raw.jobLocation), rawListingWorkplace: text(listing.raw.locations),
              jobDescription: null, sourceDetailComplete: false, detailResponseReceived: false, publicationOutcome: 'native-detail-failure' })
            continue
          }
          const row = native.jobVO, employer = native.companyVO
          if (!row || !employer || id(row.jobSeq) !== listing.jobId || id(native.jobSeq) !== listing.jobId
            || id(row.jobId) !== listing.jobId || text(row.jobTitle) !== listing.title) throw gap(`invalid native detail identity ${listing.jobId}`)
          const domains = [employer.domainName, ...(typeof employer.additionalDomainName === 'string' ? employer.additionalDomainName.split(',') : [])].map(value => value?.trim().toLowerCase())
          if (id(employer.parentCompanyMstrSeq) !== String(parentCompanyId) || id(employer.companyMstrSeq) !== id(row.companySeq)
            || companyIds.length && !companyIds.map(String).includes(id(employer.companyMstrSeq))
            || companyCodes.length && !companyCodes.includes(employer.companyCd)
            || ![new URL(origin).hostname, ...companyDomains].some(domain => domains.includes(domain.toLowerCase()))) throw gap(`unverified native employer ${listing.jobId}`)
          const closed = row.jobStatus === 'CLOSED' || native.enableLink === 'N'
          if (!closed && (native.linkDeactivated !== false || native.nonErLinkDeactivated !== false || row.jobStatus !== 'ACTIVE'
            || row.allowCareerSite !== 'Y')) throw gap(`inactive native detail ${listing.jobId}`)
          const jobDescription = descriptionText(row.jobDesc)
          const detailComplete = hasVisibleRoleCriteria(row.jobDesc, listing.title)
          const resolved = countryResolver?.({ listing: listing.raw, nativeDetail: native })
          if (resolved != null && (!resolved || typeof resolved.country !== 'string' || typeof resolved.evidence !== 'string' || !resolved.evidence)) throw gap('invalid typed native country relation')
          if (resolved && listing.country && resolved.country.toLowerCase() !== listing.country.toLowerCase()) throw gap(`contradictory native country relation ${listing.jobId}`)
          const country = resolved?.country || listing.country
          const rawCity = text(row.locations) || text(listing.raw.locations)
          const city = /^select location$/i.test(rawCity || '') ? null : rawCity
          const applyUrl = roleUrl(listing.jobId, 'apply'), sourceUrl = roleUrl(listing.jobId, 'detail')
          const job = { jobId: listing.jobId, requisitionId: text(row.jobCode) || listing.jobId, title: text(row.jobTitle), company,
            country, location: city ? (country ? `${city}, ${country}` : city) : country, city,
            link: applyUrl, applyUrl, sourceUrl, source, department: text(row.bussinessUnit),
            employmentType: normalizeEmploymentType(row.jobTypeCustom3 || row.jobType, row.jobTitle),
            experienceRequired: text(row.jobReqExp), jobDescription: detailComplete ? jobDescription : null, sourceDescriptionHtml: row.jobDesc,
            minimumQualification: null, preferredQualification: null,
            requiredSkills: extractSkills ? extractSkills(row.jobDesc) : descriptionText(row.jobSkills).split(',').map(value => value.trim()).filter(Boolean),
            postingDate: text(row.publishDetails?.CAREER_SITE) || text(row.jobPostingDate), closingDate: null,
            sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, sourceDetailComplete: detailComplete, detailResponseReceived: true,
            rawListingCountry: text(listing.raw.jobLocation), rawListingWorkplace: text(listing.raw.locations),
            rawDetailWorkplace: text(row.jobLocation), rawNativeCountryId: row.countryMstNewSeq ?? null,
            nativeCountryRelation: resolved?.evidence || (listing.country ? 'native-listing-jobLocation' : null),
            nativeState: Object.freeze({ jobStatus: row.jobStatus, enableLink: native.enableLink ?? null, linkDeactivated: native.linkDeactivated,
              nonErLinkDeactivated: native.nonErLinkDeactivated, allowCareerSite: row.allowCareerSite }),
            publicationOutcome: closed ? 'native-closed' : !detailComplete ? 'native-detail-failure' : country === null ? 'unresolved-country' : country === 'India' ? 'published-india' : 'non-india',
            scrapedAt: new Date().toISOString() }
          if (detailComplete && !closed) jobs[index] = job
          else if (!closed) failures.push(Object.freeze({ stage: 'native-detail', jobId: listing.jobId, failureKind: 'missing-full-source-content' }))
          nativeRoles[index] = Object.freeze({ ...job, requiredSkills: Object.freeze([...job.requiredSkills]) })
        }
      }
      await Promise.all(Array.from({ length: Math.min(detailConcurrency, listings.length) }, () => worker().catch(error => { stopped.abort(error); throw error })))
      const closing = await collect(opening.total)
      const openingRows = new Map(listings.map(listing => [listing.jobId, JSON.stringify(listing.raw)]))
      if (closing.listings.some(listing => openingRows.get(listing.jobId) !== JSON.stringify(listing.raw))) throw gap('changed closing native listing snapshot')
      check(activeSignal)
      const verifiedJobs = jobs.filter(job => job?.country === 'India')
      const unresolvedIds = nativeRoles.filter(job => job.country === null).map(job => job.jobId)
      const nativeInventory = Object.freeze({ source, queryScope: surface, queryParameters: Object.freeze({ ...query }), byteBudget: byteBudget(), queryReportedTotal: opening.total,
        queryEnumeratedCount: listings.length, queryDetailedCount: nativeRoles.filter(job => job.detailResponseReceived).length,
        queryDetailAttemptCount: detailAttempts, queryFullDetailCount: nativeRoles.filter(job => job.sourceDetailComplete).length,
        queryFullActiveDetailCount: jobs.filter(Boolean).length, queryClosedCount: nativeRoles.filter(job => job.publicationOutcome === 'native-closed').length,
        queryDetailFailureCount: failures.length, queryIndiaTypedCount: nativeRoles.filter(job => job.country === 'India').length,
        queryUnknownCountryCount: unresolvedIds.length, queryPagesFetched: pagesFetched,
        enumeratedIds: Object.freeze(listings.map(job => job.jobId)), detailedIds: Object.freeze(nativeRoles.filter(job => job.detailResponseReceived).map(job => job.jobId)),
        nativeRoles: Object.freeze([...nativeRoles]), unresolvedIds: Object.freeze(unresolvedIds),
        closingStable: true, queryEnumerationComplete: true, queryCountryScopeComplete: unresolvedIds.length === 0,
        companyGlobalTotal: null, companyIndiaTotal: null, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
        failures: Object.freeze([...failures]),
        outcomeCounts: Object.freeze({ publishedIndia: verifiedJobs.length, nativeClosed: nativeRoles.filter(job => job.publicationOutcome === 'native-closed').length,
          unresolvedCountry: nativeRoles.filter(job => job.publicationOutcome === 'unresolved-country').length,
          nonIndia: nativeRoles.filter(job => job.publicationOutcome === 'non-india').length, nativeDetailFailure: failures.length }) })
      completedInventory = nativeInventory
      if (!verifiedJobs.length && failures.length) throw gap('native details incomplete; no verified India full-detail jobs available')
      Object.defineProperty(verifiedJobs, 'nativeInventory', { value: nativeInventory })
      if (verifiedJobs.length) verifiedJobs[0].nativeCollectionEvidence = Object.freeze({ source,
        observedListingCount: listings.length, candidateDetails: listings.length,
        unresolvedRoles: Object.freeze(nativeRoles.filter(job => job.country === null)),
        jobs: Object.freeze(nativeRoles.filter(job => job.publicationOutcome === 'published-india')),
        extractedDetailJobs: verifiedJobs.length,
        exclusions: Object.freeze(nativeRoles.filter(job => ['native-closed','unresolved-country','non-india'].includes(job.publicationOutcome)).map(job => Object.freeze({
          jobId: job.jobId, country: job.country, reason: job.publicationOutcome === 'native-closed' ? 'native-closed' : job.country === null ? 'unresolved-native-country' : 'native-foreign-country',
          ...(job.publicationOutcome === 'native-closed' ? { nativeState: job.nativeState } : {}) }))),
        failures: Object.freeze([...failures]), listingPaginationComplete: true, closingInventoryMatches: true, sourceScopeComplete: false })
      attachSourceObservationEvidence(verifiedJobs, { source, recordKind: 'vacancy-rows', observedRecordCount: listings.length,
        observedVacancyCount: listings.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
      return attachInventoryEvidence(verifiedJobs, evidence(failures.length ? 'native-json-board-enumerated;native-full-details-incomplete;company-scope-unverified' : unresolvedIds.length
        ? 'native-json-board-reconciled;typed-job-countries-unresolved;company-scope-unverified'
        : 'native-json-board-opening-details-closing-reconciled;company-scope-unverified'))
    } catch (error) {
      stopped.abort(error)
      check(signal)
      if (error && (typeof error === 'object' || typeof error === 'function') && Object.isExtensible(error)) {
        Object.assign(error, { abortRetries: true, softFailure: true, failureKind: 'coverage_gap',
          inventoryEvidence: evidence('native-json-board-not-reconciled'),
          sourceObservations: { source, recordKind: 'vacancy-rows', observedRecordCount: observedOpeningRows.length,
            observedVacancyCount: observedOpeningRows.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null },
          nativeInventory: completedInventory || { source, observedListingCount: observedOpeningRows.length,
            queryReportedTotal: opening?.total ?? observedTotal, detailedCount: nativeRoles.filter(Boolean).length,
            nativeRoles: nativeRoles.filter(Boolean), byteBudget: byteBudget(), sourceScopeComplete: false, lifecycleCleanupAllowed: false } })
      }
      throw error
    } finally { clearTimeout(timer) }
  },
})
