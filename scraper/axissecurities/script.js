import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { requireProof, validateCompany, validateListing, readDetail } from './parser.js'
import {isJobInPublicLocationScope} from '../../src/utils/publicJobLocationScope.js'
import {isNativeBareCityInPublicScope} from '../../scraper-support/shared/nativeCityScope.js'

export const SOURCE = 'axissecurities'
export const COMPANY = 'Axis Securities'
export const FIRST_PARTY_CAREERS_URL = 'https://simplehai.axisdirect.in/portal/careers'

export const ORIGIN = 'https://axissecurities.ripplehire.com'
export const TOKEN = 'aA6ANFk4CHLUkuOVBmxq'
export const BOARD_URL = `${ORIGIN}/candidate/?token=${TOKEN}&source=CAREERSITE#list`
export const BOARD_HTTP_URL = BOARD_URL.split('#')[0]
export const COMPANY_URL = `${ORIGIN}/candidate/getcandidatecompanydetails?token=${TOKEN}&source=CAREERSITE&page=%23list&lang=en`
export const SEARCH_URL = `${ORIGIN}/candidate/candidatejobsearch`
export const detailApiUrl = id => `${ORIGIN}/candidate/candidatejobdetail?token=${TOKEN}&jobSeq=${id}&source=CAREERSITE&lang=en`
export const detailUrl = id => `${BOARD_HTTP_URL}#detail/job/${id}`
const buildBody = page => new URLSearchParams({ careerSiteUrlParams: JSON.stringify({ page, search: '*:*', token: TOKEN, source: 'CAREERSITE', pagesize: 10 }), lang: 'en' }).toString()

export const inspectInventory = async ({ fetchImpl = fetch, signal, timeoutMs = 120000, now = () => new Date().toISOString(), maxPages = 100, maxJobs = null, maxResponseBytes = 8 * 1024 * 1024 } = {}) => {
  signal?.throwIfAborted()
  requireProof(Number.isFinite(timeoutMs) && timeoutMs > 0 && Number.isSafeInteger(maxPages) && maxPages > 0
    && Number.isSafeInteger(maxResponseBytes) && maxResponseBytes > 0
    && (maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0), 'invalid runtime bounds')
  const controller = new AbortController(), combined = signal ? AbortSignal.any([signal,controller.signal]) : controller.signal
  const deadline = performance.now() + timeoutMs
  const checkDeadline = () => {
    if (!combined.aborted && performance.now() >= deadline) controller.abort(Error('Axis Securities aggregate deadline exceeded'))
    combined.throwIfAborted()
  }
  let timer, listener
  const cancelled = new Promise((_, reject) => {
    listener = () => reject(combined.reason)
    combined.addEventListener('abort',listener,{ once: true })
    timer = setTimeout(() => controller.abort(Error('Axis Securities aggregate deadline exceeded')),timeoutMs)
  })
  const collect = async () => {
    let pagesFetched = 0, total = null, listingComplete = false, cityFacets = null
    const read = async (url, options = {}) => {
      checkDeadline()
      const response = await fetchImpl(url,{ redirect: 'error', ...options, signal: combined,
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0', ...(options.headers || {}) } })
      const cancelBody = () => { try { Promise.resolve(response.body?.cancel(combined.reason)).catch(() => {}) } catch {} }
      if (combined.aborted) { cancelBody(); combined.throwIfAborted() }
      if (response.status !== 200 || response.url !== url) {
        cancelBody()
        requireProof(false, 'native HTTP status or final URL changed')
      }
      requireProof(typeof response.body?.getReader === 'function', 'native response stream unavailable')
      const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
      let bytes = 0, body = '', done = false
      const cancelReader = () => { try { Promise.resolve(reader.cancel(combined.reason)).catch(() => {}) } catch {} }
      combined.addEventListener('abort',cancelReader,{ once: true })
      try {
        while (true) {
          checkDeadline()
          const chunk = await reader.read()
          checkDeadline()
          if (chunk.done) { body += decoder.decode(); done = true; break }
          bytes += chunk.value.byteLength
          requireProof(bytes <= maxResponseBytes, 'native response byte limit exceeded')
          body += decoder.decode(chunk.value,{ stream: true })
        }
      } finally {
        combined.removeEventListener('abort',cancelReader)
        if (!done) cancelReader()
        try { reader.releaseLock() } catch {}
      }
      checkDeadline()
      pagesFetched++
      return body
    }
    const doc = document(await read(FIRST_PARTY_CAREERS_URL))
    const links = doc.nodes(n => n.tag === 'button' || n.tag === 'a')
    requireProof(links.some(n => n.attrs.href === BOARD_URL || new RegExp("^\\s*window\\.location\\.href\\s*=\\s*(['\"])(.*?)\\1\\s*;?\\s*$").exec(n.attrs.onclick || '')?.[2] === BOARD_URL), 'official RippleHire handoff changed')
    const board = await read(BOARD_HTTP_URL)
    requireProof(activeHead(board).titles.length === 1 && activeHead(board).titles[0] === 'Axis Securities Limited Careers | Latest jobs at Axis Securities Limited - Ripplehire.com', 'native board identity changed')
    validateCompany(JSON.parse(await read(COMPANY_URL)))
    const listings = [], ids = new Set()
    for (let page = 0; page < maxPages; page++) {
      const payload = JSON.parse(await read(SEARCH_URL,{ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: buildBody(page) }))
      requireProof(payload.errorStatus === 'success' && Number.isSafeInteger(payload.totalJobCount) && payload.totalJobCount >= 0
        && payload.startJobIndex === page * 10 && payload.maxJobSize === 10 && Array.isArray(payload.jobVoList), 'malformed native pagination contract')
      if (total === null) { total = payload.totalJobCount; cityFacets = payload.cityCount }
      requireProof(total === payload.totalJobCount && JSON.stringify(cityFacets) === JSON.stringify(payload.cityCount), 'native inventory totals/facets changed during pagination')
      requireProof(payload.jobVoList.length === Math.min(10,Math.max(0,total - page * 10)), 'truncated native listing page')
      for (const row of payload.jobVoList) {
        validateListing(row)
        requireProof(!ids.has(row.jobSeq), 'duplicate native listing identity')
        ids.add(row.jobSeq); listings.push(row)
      }
      if (listings.length === total) { listingComplete = true; break }
    }
    const selected = maxJobs === null ? listings : listings.slice(0,maxJobs)
    const details = await mapWithConcurrency(selected,4,async listing => readDetail(JSON.parse(await read(detailApiUrl(listing.jobSeq))),listing,total))
    checkDeadline()
    return { listings, details, reportedTotal: total, listingComplete, detailsComplete: details.length === listings.length,
      pagesFetched, unknownCountryCount: details.filter(fact => !fact.country).length,
      missingDescriptionCount: details.filter(fact => !fact.description).length, cityFacets, verifiedAt: now() }
  }
  try { return await Promise.race([collect(),cancelled]) } finally {
    clearTimeout(timer); combined.removeEventListener('abort',listener)
    if (!controller.signal.aborted) controller.abort(Error('Axis Securities collection settled'))
  }
}

export const run = async options => {
  const result = await inspectInventory(options)
  const complete = result.listingComplete && result.detailsComplete && result.unknownCountryCount === 0
    && result.details.filter(fact => fact.country === 'India').every(fact => fact.description)
  // Central Delhi is the native publisher's observed district label; it is
  // already accepted as Delhi by the existing public location rule.
  const bareCity=label=>isNativeBareCityInPublicScope(label,{extraLabels:['central delhi']})
  const jobs = result.details.filter(fact => {
    const location=fact.row.jobLocation
    if(fact.country&&fact.country!=='India')return false
    // Country remains unknown for bare city labels. Use the existing public
    // city gate, and withhold unresolved composites or explicit foreign facts.
    if(!fact.country&&!bareCity(location))return false
    return isJobInPublicLocationScope({country:fact.country,location})
  }).map(fact => ({
    source: SOURCE, company: COMPANY, jobId: fact.row.jobSeq, requisitionId: fact.row.jobCode, title: fact.row.jobTitle,
    sourceUrl: detailUrl(fact.row.jobSeq), applyUrl: detailUrl(fact.row.jobSeq), link: detailUrl(fact.row.jobSeq),
    country: fact.country, location: fact.row.jobLocation, city: null, state: null,
    jobDescription: fact.description, sourceDescription: fact.description, nativeDescriptionHTML: fact.row.jobDesc,
    experienceRequired: fact.row.jobReqExp || null, employmentType: fact.row.jobType === 'R' ? 'Full-time' : null,
    postingDate: fact.publicationDate, postedAt: fact.publicationDate, nativePublicationSource: fact.publicationSource,
    nativeJobPostingDate: fact.row.jobPostingDate, nativePublishDetails: fact.row.publishDetails,
    sourceDetailComplete: Boolean(fact.description), sourceDetailStatus: fact.description ? 'complete' : 'partial',
    sourceDetailFailureKind: fact.description ? null : 'missing-content', sourceListingComplete: complete,
    nativeLocationEvidence: { jobLocation: fact.row.jobLocation, locations: fact.row.locations, countryMstNewSeq: fact.row.countryMstNewSeq, jobLocationList: fact.row.jobLocationList },
    scrapedAt: result.verifiedAt,
  }))
  return attachInventoryEvidence(jobs,{ status: complete ? result.reportedTotal === 0 ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
    firstParty: true, surface: SEARCH_URL, listingComplete: complete, pagesFetched: result.pagesFetched, reportedTotal: result.reportedTotal,
    indiaFacetCount: null, verifiedAt: result.verifiedAt, reason: complete ? 'Native paginated public inventory fully reconciled with employer-bound detail and explicit countries.'
      : `${result.unknownCountryCount} native details have unknown country; ${result.missingDescriptionCount} lack a substantive JD. Native listings=${result.listings.length}/${result.reportedTotal}; hydrated details=${result.details.length}. ${jobs.length} satisfy the existing public location policy; unknown countries remain null. No zero-India claim.` })
}
export const createAxisSecuritiesScraper = () => ({ run })
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
