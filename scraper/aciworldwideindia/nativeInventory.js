import { createHash } from 'node:crypto'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const SOURCE = 'aciworldwideindia'
export const ACI_NATIVE_REPORT = Symbol.for('jobverify.aci-native-inventory')
const error = (message, failureKind = 'upstream_contract_changed', code) => Object.assign(
  new Error(`[${SOURCE}] ${message}`), { softFailure: true, upstreamOutage: false, failureKind,
    sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    ...(code ? { code } : {}) })
const requireContract = (valid, message) => { if (!valid) throw error(message) }
const changed = message => error(message, 'upstream_inventory_changed')
const bounded = (message, code) => error(message, 'coverage_gap', code)
const hash = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const plain = value => text(String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' '))

// Only native country fields and explicit country names resolve geography. A
// city, employer, finder query, or search rank never supplies a missing country.
const countryCodes = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '))
const countryLabels = new Map()
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
for (const code of countryCodes) countryLabels.set(displayNames.of(code).toLowerCase(), code)
for (const [label, code] of Object.entries({ 'united states of america': 'US', usa: 'US', uk: 'GB',
  'czech republic': 'CZ', 'south korea': 'KR', 'north korea': 'KP', 'russian federation': 'RU',
  vietnam: 'VN', 'viet nam': 'VN', 'taiwan, province of china': 'TW', turkey: 'TR' })) countryLabels.set(label, code)
const explicitCountry = value => {
  const normalized = text(value)
  return countryCodes.has(normalized.toUpperCase()) ? normalized.toUpperCase()
    : countryLabels.get(normalized.toLowerCase()) || null
}
const labelCountry = value => explicitCountry(text(value).split(',').at(-1))
export const classifyAciLocations = record => {
  requireContract(record?.secondaryLocations == null || Array.isArray(record.secondaryLocations), 'Malformed secondary native locations')
  const locations = [{ code: record?.PrimaryLocationCountry, label: text(record?.PrimaryLocation) },
    ...(record?.secondaryLocations || []).map(location => ({ code: location?.CountryCode, label: text(location?.Name || location?.LocationName) }))]
    .map(location => {
      const code = explicitCountry(location.code), label = labelCountry(location.label)
      requireContract(!code || !label || code === label, 'Conflicting typed native country and worksite country')
      return { ...location, country: text(location.code) && !code ? null : code || label }
    })
  return { locations, india: locations.some(location => location.country === 'IN'),
    complete: locations.every(location => location.country !== null) }
}
export const indiaAciLocation = record => classifyAciLocations(record).locations
  .find(location => location.country === 'IN')?.label || null

const positive = (value, fallback, name, ceiling = Number.MAX_SAFE_INTEGER) => {
  const selected = value ?? fallback
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > ceiling) throw new RangeError(`Invalid ACI ${name}`)
  return selected
}

function createReader(options, spec) {
  const callerSignal = options.signal, controller = new AbortController()
  const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal
  const sourceTimeoutMs = positive(options.sourceTimeoutMs, 180000, 'source timeout', 600000)
  const requestTimeoutMs = positive(options.requestTimeoutMs, 20000, 'request timeout', 60000)
  const maxRequests = positive(options.maxRequests, 300, 'request limit', 10000)
  const maxResponseBytes = positive(options.maxResponseBytes, 8 * 1024 * 1024, 'response byte limit', 32 * 1024 * 1024)
  const maxTotalBytes = positive(options.maxTotalBytes, 64 * 1024 * 1024, 'source byte limit', 256 * 1024 * 1024)
  const sourceTimer = setTimeout(() => controller.abort(bounded('Source read deadline exceeded', 'ACI_SOURCE_TIMEOUT')), sourceTimeoutMs)
  const responses = [], denied = new Set()
  let requests = 0, totalBytes = 0
  const check = requestSignal => { callerSignal?.throwIfAborted(); signal.throwIfAborted(); requestSignal?.throwIfAborted() }
  const allowed = url => {
    const target = new URL(url)
    if (target.protocol !== 'https:' || target.username || target.password || target.port || target.hash) return false
    if (target.origin === new URL(spec.corporate).origin) return !target.search
      && /^\/about-aci\/careers(?:\/[a-z0-9-]+)*\/?$/.test(target.pathname)
    if (url === spec.candidate) return true
    if (target.origin !== new URL(spec.candidate).origin) return false
    if (url.startsWith(spec.listing + '?')) return /^\?onlyData=true&expand=requisitionList\.secondaryLocations&finder=findReqs;siteNumber=CX,limit=24,offset=\d+,location=$/.test(target.search)
    return url.startsWith(spec.detail + '?')
      && /^\?expand=all&onlyData=true&finder=ById;Id=%22\d{1,32}%22,siteNumber=CX$/.test(target.search)
  }
  const read = async (url, kind, cohortSignal) => {
    check(cohortSignal)
    requireContract(allowed(url), 'Request outside verified public ACI GET surface')
    if (denied.has(new URL(url).origin)) throw error('Public origin already denied', 'upstream_blocked')
    if (++requests > maxRequests) throw bounded('Public GET request limit exceeded', 'ACI_REQUEST_LIMIT')
    const requestController = new AbortController()
    const requestSignal = AbortSignal.any([signal, requestController.signal, ...(cohortSignal ? [cohortSignal] : [])])
    const timer = setTimeout(() => requestController.abort(bounded('Public GET deadline exceeded', 'ACI_REQUEST_TIMEOUT')), requestTimeoutMs)
    const requestedAt = new Date().toISOString()
    let reader
    try {
      return await readNativeWithSignal(async () => {
        const init = { method: 'GET', credentials: 'omit', redirect: 'manual', signal: requestSignal,
          headers: { Accept: kind === 'json' ? 'application/json' : 'text/html,application/xhtml+xml' } }
        const injected = kind === 'json' ? options.fetchJson : options.fetchText
        let body, status = 200, finalUrl = url, contentType = kind === 'json' ? 'application/json' : 'text/html'
        if (injected && !options.fetchPage) {
          const value = await injected(url, init)
          check(requestSignal)
          body = kind === 'json' ? JSON.stringify(value) : value
        } else {
          const response = options.fetchPage ? await options.fetchPage(url, init)
            : await (options.fetchImpl || globalThis.fetch)(url, init)
          check(requestSignal)
          status = response?.status
          finalUrl = response?.url || url
          contentType = response?.contentType ?? response?.headers?.get?.('content-type') ?? ''
          if ([401, 403, 429, 451].includes(status)) denied.add(new URL(url).origin)
          if (status !== 200) throw Object.assign(error(`Public GET HTTP ${status}`, 'upstream_blocked'), { status })
          requireContract(finalUrl === url, 'Unexpected public GET redirect')
          requireContract((kind === 'json' ? /(?:application|text)\/(?:[\w.+-]*\+)?json\b/i : /text\/html|application\/xhtml\+xml/i).test(contentType), 'Unexpected public response content type')
          if (options.fetchPage) body = response.body
          else if (response.body?.getReader) {
            reader = response.body.getReader()
            const chunks = []
            let bytes = 0
            for (;;) {
              const chunk = await reader.read()
              check(requestSignal)
              if (chunk.done) break
              bytes += chunk.value.byteLength
              if (bytes > maxResponseBytes) throw bounded('Public response byte limit exceeded', 'ACI_RESPONSE_LIMIT')
              if (totalBytes + bytes > maxTotalBytes) throw bounded('Source response byte limit exceeded', 'ACI_SOURCE_BYTE_LIMIT')
              chunks.push(chunk.value)
            }
            body = Buffer.concat(chunks).toString('utf8')
          } else body = await response.text()
        }
        check(requestSignal)
        requireContract(typeof body === 'string' || Buffer.isBuffer(body), 'Public response body missing')
        const bytes = Buffer.byteLength(body)
        if (bytes > maxResponseBytes) throw bounded('Public response byte limit exceeded', 'ACI_RESPONSE_LIMIT')
        if (totalBytes + bytes > maxTotalBytes) throw bounded('Source response byte limit exceeded', 'ACI_SOURCE_BYTE_LIMIT')
        totalBytes += bytes
        body = String(body)
        requireContract(!/<title[^>]*>\s*(?:just a moment|access denied|attention required)|<(?:h1|p)\b[^>]*>\s*(?:captcha challenge|verify you are human)/i.test(body), 'Explicit public access gate')
        responses.push({ url, method: 'GET', status, contentType, finalUrl, requestedAt,
          completedAt: new Date().toISOString(), bytes, bodySHA256: hash(body) })
        if (kind !== 'json') return body
        try { return JSON.parse(body) } catch { throw error('Malformed public JSON') }
      }, requestSignal)
    } catch (cause) { check(requestSignal); throw cause }
    finally {
      clearTimeout(timer)
      // Cancellation must also cover body readers that ignore AbortSignal.
      if (reader) Promise.resolve(reader.cancel()).catch(() => {})
    }
  }
  return { signal, read, responses, check, close() { clearTimeout(sourceTimer); controller.abort() } }
}

const anchors = html => [...String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(match => ({ href: match[1].replace(/&amp;|&#0*38;/gi, '&'), label: plain(match[2]) }))
async function verifyDelegation(reader, spec, maxCorporatePages) {
  const queue = [spec.corporate], pages = [], unresolved = new Set()
  for (let index = 0; index < queue.length; index++) {
    if (queue.length > maxCorporatePages) throw bounded('Linked corporate careers page limit exceeded', 'ACI_CORPORATE_PAGE_LIMIT')
    const url = queue[index], html = await reader.read(url, 'html')
    requireContract(index ? /<title[^>]*>[^<]*ACI Worldwide[^<]*<\/title>/i.test(html) : spec.isCorporate(html),
      'ACI Worldwide India verified official ACI Worldwide careers page no longer matches the known first-party handoff')
    const links = anchors(html), delegates = [], searchViews = []
    for (const link of links) {
      let target
      try { target = new URL(link.href, url) } catch { continue }
      if (target.origin === new URL(spec.corporate).origin && target.pathname.startsWith('/about-aci/careers/')) {
        target.hash = ''
        if (target.search || !/^\/about-aci\/careers(?:\/[a-z0-9-]+)*\/?$/.test(target.pathname)) unresolved.add(target.href)
        else if (!queue.includes(target.href)) queue.push(target.href)
      } else if (/explore opportunities|(?:view|search|find|browse|apply for)\s+(?:all\s+|open\s+)?(?:jobs|roles|careers|opportunities)|apply now/i.test(link.label)
        || /oraclecloud|workdayjobs|greenhouse\.io|jobs\.lever|smartrecruiters|icims\.com|taleo\.net|CandidateExperience/i.test(target.href)) {
        const root = /^\/hcmUI\/CandidateExperience\/en\/sites\/CX\/?$/.test(target.pathname) && !target.search
        const search = /^\/hcmUI\/CandidateExperience\/en\/sites\/CX\/requisitions\/?$/.test(target.pathname)
          && [...target.searchParams.keys()].every(key => ['keyword', 'mode'].includes(key))
          && target.searchParams.getAll('keyword').length === 1 && target.searchParams.get('keyword').length <= 300
          && target.searchParams.getAll('mode').length <= 1
          && [null, 'location'].includes(target.searchParams.get('mode'))
        if (target.origin === new URL(spec.candidate).origin && (root || search)
          && !target.username && !target.password && !target.hash) {
          delegates.push(spec.candidate.replace(/\/$/, ''))
          if (search) searchViews.push(target.href)
        } else unresolved.add(target.href)
      }
    }
    if (!delegates.length) unresolved.add(url + '#no-current-public-handoff')
    pages.push({ url, delegates: [...new Set(delegates)].sort(), searchViews: [...new Set(searchViews)].sort() })
  }
  const shell = await reader.read(spec.candidate, 'html')
  requireContract(spec.isCandidate(shell), 'ACI Worldwide India verified Oracle candidate experience page no longer matches the known first-party shell')
  return { pages: pages.sort((a, b) => a.url.localeCompare(b.url)), unresolved: [...unresolved].sort() }
}

// Reconcile fields defining a public vacancy, excluding search rank and other
// volatile decorations that can change without adding or removing a job.
const inventoryFingerprint = rows => hash(JSON.stringify(rows.map(record => ({
  id: String(record.Id), title: text(record.Title), primaryCountry: record.PrimaryLocationCountry,
  primaryLocation: record.PrimaryLocation, secondaryLocations: record.secondaryLocations,
  posted: record.PostedDate, closes: record.PostingEndDate, shortDescription: record.ShortDescriptionStr,
  organization: record.Organization, legalEmployer: record.LegalEmployer,
})).sort((a, b) => a.id.localeCompare(b.id))))

export async function collectAciInventory(options, spec) {
  const maxPages = options.maxPages === Infinity ? Infinity : positive(options.maxPages, 100, 'page limit', 10000)
  const maxJobs = options.maxJobs == null || options.maxJobs === 0 || options.maxJobs === Infinity ? Infinity
    : positive(options.maxJobs, Infinity, 'job limit', 100000)
  const maxNativeJobs = positive(options.maxNativeJobs, 2400, 'native job limit', 100000)
  const detailConcurrency = positive(options.detailConcurrency, 1, 'detail concurrency', 10)
  const maxCorporatePages = positive(options.maxCorporatePages, 12, 'corporate page limit', 40)
  const reader = createReader(options, spec)
  const checkedAt = () => {
    const value = typeof options.now === 'function' ? options.now() : options.now ?? new Date()
    const date = new Date(value)
    requireContract(Number.isFinite(date.valueOf()), 'Invalid inventory observation timestamp')
    return date.toISOString()
  }
  try {
    const delegation = await verifyDelegation(reader, spec, maxCorporatePages)
    const enumerate = async () => {
      const rows = [], ids = new Set(), pages = []
      let total = null, exhausted = false
      for (let page = 0; page < maxPages; page++) {
        const offset = page * 24, payload = await reader.read(spec.search({ page, location: '' }), 'json')
        requireContract(Array.isArray(payload?.items) && payload.items.length === 1, 'Missing native inventory envelope')
        const collection = payload.items[0]
        requireContract(Array.isArray(collection?.requisitionList) && collection.SiteNumber === 'CX'
          && collection.Offset === offset && collection.Limit === 24 && collection.Location == null
          && ['Keyword', 'LocationId', 'SelectedTitlesFacet', 'SelectedCategoriesFacet', 'SelectedPostingDatesFacet',
            'SelectedLocationsFacet', 'JobFamilyId', 'PostingStartDate', 'PostingEndDate', 'SelectedWorkLocationsFacet',
            'RequisitionId', 'WorkLocationZipCode', 'WorkLocationCountryCode', 'SelectedFlexFieldsFacets',
            'OrganizationId', 'SelectedOrganizationsFacet', 'UserTargetFacetName', 'UserTargetFacetInputTerm',
            'HotJobFlag', 'WorkplaceType', 'SelectedWorkplaceTypesFacet'].every(key => collection[key] == null || collection[key] === '')
          && Number.isSafeInteger(collection.TotalJobsCount) && collection.TotalJobsCount >= 0
          && collection.TotalJobsCount <= 100000, 'Invalid global native site, filter, total, limit or offset')
        if (collection.TotalJobsCount > maxNativeJobs) throw bounded('Native inventory job limit exceeded', 'ACI_NATIVE_JOB_LIMIT')
        total ??= collection.TotalJobsCount
        if (collection.TotalJobsCount !== total) throw changed('Native total changed during pagination')
        requireContract(collection.requisitionList.length <= Math.min(24, Math.max(0, total - offset)), 'Native page exceeds requested range')
        for (const record of collection.requisitionList) {
          requireContract(record && /^\d{1,32}$/.test(String(record.Id ?? '')) && text(record.Title), 'Invalid native vacancy identity')
          if (ids.has(String(record.Id))) throw changed('Duplicate or overlapping native role identity')
          ids.add(String(record.Id))
          classifyAciLocations(record)
          rows.push(record)
        }
        pages.push({ offset, rows: collection.requisitionList.length })
        if (offset + 24 >= total) { exhausted = true; break }
      }
      return { rows, pages, total, exhausted, complete: exhausted && rows.length === total }
    }
    const opening = await enumerate(), failures = [], exclusions = []
    const candidates = opening.rows.filter(record => {
      const countries = classifyAciLocations(record)
      if (!countries.complete) failures.push({ stage: 'native-country', id: String(record.Id), reason: 'native-location-scope-unresolved' })
      return countries.india || !countries.complete
    })
    const selected = candidates.slice(0, maxJobs), limited = selected.length !== candidates.length
    const jobsByIndex = new Array(selected.length), cohort = new AbortController()
    const cohortSignal = AbortSignal.any([reader.signal, cohort.signal])
    let cursor = 0, fatal
    const worker = async () => {
      while (cursor < selected.length && !cohortSignal.aborted) {
        const index = cursor++, record = selected[index], id = String(record.Id)
        try {
          const listing = spec.extractListings({ items: [{ requisitionList: [record] }] })[0]
          let payload
          try { payload = await reader.read(spec.detailURL(id), 'json', cohortSignal) }
          catch (cause) {
            reader.check(cohortSignal)
            if (cause.failureKind === 'upstream_contract_changed' || cause.code?.startsWith('ACI_')) throw cause
            failures.push({ stage: 'native-detail', id, reason: 'upstream' })
            if (listing) jobsByIndex[index] = { ...listing, sourceDetailComplete: false, sourceDetailFailureKind: 'upstream' }
            else exclusions.push({ id, reason: 'native-country-unresolved' })
            continue
          }
          requireContract(Array.isArray(payload?.items) && payload.items.length === 1, 'Invalid native detail envelope')
          const detail = payload.items[0]
          requireContract(String(detail?.Id) === id && text(detail?.Title) === text(record.Title), 'Listing/detail vacancy identity or title conflict')
          const listingCountries = classifyAciLocations(record), detailCountries = classifyAciLocations(detail)
          const primaryListing = listingCountries.locations[0].country, primaryDetail = detailCountries.locations[0].country
          requireContract(!primaryListing || !primaryDetail || primaryListing === primaryDetail, 'Listing/detail primary native countries conflict')
          requireContract(!listingCountries.india || detailCountries.india || !detailCountries.complete, 'Listing/detail India worksite countries conflict')
          if (!detailCountries.india) {
            exclusions.push({ id, reason: detailCountries.complete ? 'native-country-foreign' : 'native-country-unresolved' })
            continue
          }
          const job = spec.extractDetail(payload, listing || {})
          const hasBody = hasSourceDescription({ sourceDescription: [detail.ExternalDescriptionStr,
            detail.ExternalResponsibilitiesStr, detail.ExternalQualificationsStr].filter(value => typeof value === 'string').join('\n') })
          const complete = hasBody && detailCountries.complete
          if (!complete) failures.push({ stage: 'native-detail', id, reason: hasBody ? 'native-location-scope-unresolved' : 'missing-content' })
          jobsByIndex[index] = { ...job, sourceDetailComplete: complete,
            ...(!complete ? { sourceDetailFailureKind: hasBody ? 'native-location-scope-unresolved' : 'missing-content' } : {}) }
        } catch (cause) { fatal ||= cause; cohort.abort(fatal); throw cause }
      }
    }
    await Promise.allSettled(Array.from({ length: Math.min(detailConcurrency, selected.length) }, worker))
    reader.check()
    if (fatal) throw fatal
    const jobs = jobsByIndex.filter(Boolean)
    let closing = null, closingDelegation = null
    if (opening.exhausted) {
      closing = await enumerate()
      closingDelegation = await verifyDelegation(reader, spec, maxCorporatePages)
      if (!closing.exhausted || closing.total !== opening.total
        || inventoryFingerprint(closing.rows) !== inventoryFingerprint(opening.rows)
        || JSON.stringify(delegation) !== JSON.stringify(closingDelegation)) throw changed('Closing native inventory or first-party delegation changed after hydration')
    }
    const listingComplete = opening.complete && closing?.complete === true && !limited
    const scopeComplete = listingComplete && delegation.unresolved.length === 0 && !failures.some(failure => failure.stage === 'native-country')
    const complete = scopeComplete && failures.length === 0 && jobs.every(job => job.sourceDetailComplete)
    const verifiedAt = checkedAt(), report = {
      source: SOURCE, observedListingCount: opening.rows.length, reportedTotal: opening.total,
      observedIndiaListingCount: opening.rows.filter(row => classifyAciLocations(row).india).length,
      nonIndiaListingCount: opening.rows.filter(row => { const countries = classifyAciLocations(row); return countries.complete && !countries.india }).length,
      listingPaginationComplete: listingComplete, closingInventoryMatches: closing !== null,
      nativeCountReconciled: opening.complete && closing?.complete === true,
      sourceScopeComplete: scopeComplete, candidateDetails: selected.length, extractedDetailJobs: jobs.length,
      excludedDetailJobs: exclusions.length, exclusions, failures, jobs: jobs.map(job => ({ id: job.jobId })),
      openingPages: opening.pages, closingPages: closing?.pages || [], delegation, limited,
      retainedResponses: reader.responses.slice(), verifiedAt,
    }
    // Both evidence types survive the actual registered provider's Array.map.
    for (const job of jobs) Object.assign(job, { source: SOURCE, link: job.applyUrl || job.sourceUrl,
      scrapedAt: verifiedAt, sourceListingComplete: scopeComplete, sourceScopeComplete: scopeComplete,
      lifecycleCleanupAllowed: complete, nativeCollectionEvidence: report })
    Object.defineProperty(jobs, ACI_NATIVE_REPORT, { value: report })
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
      observedRecordCount: opening.rows.length, observedVacancyCount: opening.rows.length, sourceScopeComplete: false })
    const reason = !opening.exhausted ? 'native-page-limit-reached' : !opening.complete ? 'native-inventory-count-unreconciled'
      : limited ? 'native-job-limit-reached' : delegation.unresolved.length ? 'additional-hiring-scope-unverified'
        : !scopeComplete ? 'native-location-scope-unresolved' : !complete ? 'native-details-incomplete'
          : 'global-native-inventory-and-first-party-handoff-reconciled'
    attachInventoryEvidence(jobs, { status: complete ? opening.total === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
      surface: spec.corporate, firstParty: true, listingComplete: complete,
      pagesFetched: opening.pages.length + (closing?.pages.length || 0),
      reportedTotal: opening.total, indiaFacetCount: scopeComplete ? jobs.length : null, verifiedAt, reason })
    if (typeof options.onReport === 'function') await readNativeWithSignal(() => options.onReport(report), reader.signal)
    reader.check()
    return jobs
  } finally { reader.close() }
}
