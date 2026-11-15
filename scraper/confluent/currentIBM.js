import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { buildSearchRequestBody } from '../hashicorp/searchApi.js'

const CAREERS = 'https://careers.confluent.io/'
const LANDING = 'https://www.ibm.com/careers/search?q=confluent'
const API = 'https://www-api.ibm.com/search/api/v2'
const text = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : ''
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('[confluent] Current IBM inventory: ' + message), {
    abortRetries: true, softFailure: true, failureKind: 'surface_drift_or_fail_closed',
  })
}

// The employer moved its careers host to IBM. The old Ashby board still serves
// an empty valid envelope, so it cannot establish the employer's current zero.
// Search matches that merely mention a Confluent skill are retained as raw
// observations; only explicitly brand-titled, typed India posts are selected.
export async function runCurrentConfluentInventory(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(85000)])
  const request = async (url, init = {}) => {
    signal.throwIfAborted()
    const response = await (options.fetchImpl || globalThis.fetch)(url, { ...init, redirect: 'manual',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), credentials: 'omit',
      headers: { Accept: 'text/html,application/json', 'User-Agent': 'Mozilla/5.0', ...init.headers } })
    const body = await response.text()
    signal.throwIfAborted()
    need(Buffer.byteLength(body) <= 4 * 1024 * 1024, 'public response exceeds byte limit')
    return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), html: body }
  }
  const fetchPage = options.fetchPage || request
  const fetchJson = options.fetchJson || (async (url, init) => {
    const page = await request(url, init)
    need(page.status === 200 && page.url === API && /^application\/json\b/i.test(page.headers['content-type'] || ''),
      'native search response identity unavailable')
    return JSON.parse(page.html)
  })
  let pagesFetched = 0
  const employer = await fetchPage(CAREERS, { signal }); pagesFetched++
  signal.throwIfAborted()
  need(employer?.status === 301 && employer.url === CAREERS && employer.headers?.location === LANDING,
    'current employer IBM handoff changed')
  const landing = await fetchPage(LANDING, { signal }); pagesFetched++
  signal.throwIfAborted()
  const document = readNativeDocument(landing?.html || '')
  need(landing?.status === 200 && landing.url === LANDING
    && document.nodes(node => node.tag === 'title').some(node => text(node.raw) === 'Search jobs | IBM Careers')
    && document.nodes(node => node.tag === 'script' && !node.attrs.src)
      .some(node => /\bvar\s+careerSearchScope\s*=\s*\{\s*scopeid\s*:\s*'careers2'\s*\}\s*;/.test(node.raw || '')),
  'current IBM careers search identity unavailable')
  const all = [], seen = new Set(), sourceIds = new Set()
  let total = null
  for (let page = 0; page < 25; page++) {
    signal.throwIfAborted()
    const from = page * 100
    const payload = await fetchJson(API, { method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Origin: 'https://www.ibm.com', Referer: LANDING },
      body: JSON.stringify(buildSearchRequestBody({ query: 'confluent', country: 'India', size: 100, from })) })
    pagesFetched++; signal.throwIfAborted()
    const hits = payload?.hits?.hits, count = payload?.hits?.total
    need(Array.isArray(hits) && hits.length <= 100 && count?.relation === 'eq'
      && Number.isSafeInteger(count.value) && count.value >= 0 && count.value <= 2500
      && !payload.error && payload.timed_out !== true && !(payload._shards?.failed > 0),
    'native search envelope or exact total unavailable')
    if (total === null) total = count.value
    need(total === count.value, 'native search total changed during pagination')
    for (const hit of hits) {
      const record = hit?._source
      need(record && typeof record === 'object' && !Array.isArray(record) && text(hit._id)
        && !seen.has(hit._id) && text(record.title), 'missing or repeated native search identity')
      seen.add(hit._id)
      let url
      try { url = new URL(record.url) } catch { need(false, 'invalid native role URL') }
      need(url.origin === 'https://careers.ibm.com' && !url.username && !url.password && !url.hash
        && url.pathname === '/careers/JobDetail' && [...url.searchParams.keys()].join() === 'jobId'
        && /^\d+$/.test(url.searchParams.get('jobId')), 'foreign native role URL authority')
      const jobId = url.searchParams.get('jobId')
      need(!sourceIds.has(jobId), 'repeated native role URL identity')
      sourceIds.add(jobId)
      all.push({ ...structuredClone(record), sourceSearchId: hit._id, jobId })
    }
    need(all.length <= total && (hits.length > 0 || all.length === total), 'native search stopped before exact total')
    if (all.length === total) break
    need(hits.length === 100 && page < 24, 'native search page truncated before exact total')
  }
  const observedAt = new Date().toISOString()
  const jobs = all.filter(record => /\bConfluent\b/i.test(record.title)
    && record.field_keyword_05 === 'India'
    && text(record.body).length >= 200 && !/(?:\.\.\.|\u2026)\s*$/u.test(text(record.body))
    && /(?:,\s*IN$|^India$|^Multiple Cities$)/i.test(text(record.field_keyword_19)))
    .map(record => {
      const location = text(record.field_keyword_19).replace(/,\s*IN$/i, ', India')
      const description = text(record.body)
      return { source: 'confluent', company: 'Confluent', title: text(record.title), jobId: record.jobId,
        requisitionId: record.jobId, sourceUrl: record.url, applyUrl: record.url, link: record.url,
        country: 'India', location, city: /^multiple cities$/i.test(location) ? null : location.split(',')[0].trim(),
        department: text(record.field_keyword_08) || null, employmentType: null, postingDate: null, closingDate: null,
        remoteStatus: /^(?:Remote|Hybrid)$/i.test(text(record.field_keyword_17)) ? text(record.field_keyword_17) : null,
        jobDescription: description, sourceDescription: description, scrapedAt: observedAt,
        companyCareerPage: CAREERS, companyDomain: 'confluent.io', atsPlatform: 'ibm-careers-search',
        sourceNativeRecord: record, sourceNativeEmployerHandoff: { from: CAREERS, status: 301, to: LANDING },
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
    })
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: { source: 'confluent',
    nativeRecords: all, currentEmployerHandoff: { from: CAREERS, status: 301, to: LANDING },
    observedSearchTotal: total, searchPaginationReconciled: all.length === total,
    sourceScopeComplete: false, unselectedSearchMatches: all.filter(record => !jobs.some(job => job.jobId === record.jobId)) } })
  attachSourceObservationEvidence(jobs, { source: 'confluent', recordKind: 'vacancy-rows',
    observedRecordCount: all.length, observedVacancyCount: all.length, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: API, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: observedAt, reason: 'current-employer-redirect-to-IBM;explicit-native-Confluent-titles-and-India-country;whole-source-scope-unqualified' })
}
