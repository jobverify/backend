import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName, nativeLocationCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { isNativeBareCityInPublicScope } from '../../scraper-support/shared/nativeCityScope.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'nseit'
export const COMPANY_NAME = 'NSEIT'
export const CAREERS_URL = 'https://www.nseit.com/careers'
export const CURRENT_CAREERS_URL = 'https://www.dexitglobal.com/careers/'
export const IDENTITY_URL = 'https://www.dexitglobal.com/about-us/'
export const DISPOSITION = 'live-parser'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'First-party legal successor DEXIT Global Limited (formerly NSEIT Limited), native WP Job Openings inventory. Matching native Mumbai labels qualify under existing city policy with country null and original posting date. Whole inventory remains incomplete; no certified India total or cleanup.'
const requireNative = (condition, message) => { if (!condition) throw new Error('NSEIT ' + message) }
// Add the visibility property absent from the shared slice reader. Preserve
// exact content while ensuring hidden descendants cannot furnish public facts.
const active = html => document(html.replace(/content-visibility\s*:\s*hidden/gi, 'visibility:hidden'))
const one = (items, name) => { requireNative(items.length === 1, 'missing/ambiguous ' + name); return items[0] }
const firstParty = url => { const parsed = new URL(url); requireNative(parsed.origin === 'https://www.dexitglobal.com', 'foreign native URL'); return parsed.href }
const publicDate = value => {
 if (value == null || value === '') return null
 requireNative(typeof value === 'string' && /^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d))?$/.test(value), 'invalid publication date')
 const day = value.slice(0, 10), midnight = new Date(day)
 requireNative(Number.isFinite(+new Date(value)) && Number.isFinite(+midnight) && midnight.toISOString().slice(0, 10) === day, 'invalid native calendar date')
 return value
}

export const createNseitScraper = () => ({
 async run({ fetchImpl = globalThis.fetch, signal, timeoutMs = 60000, maxResponseBytes = 4 * 1024 * 1024, maxTotalBytes = 16 * 1024 * 1024, now = () => new Date().toISOString() } = {}) {
  requireNative(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 2147483647, 'invalid timeoutMs')
  for (const [name, value] of Object.entries({ maxResponseBytes, maxTotalBytes })) requireNative(Number.isSafeInteger(value) && value > 0, 'invalid ' + name)
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('NSEIT aggregate deadline exceeded')), timeoutMs)
  let rejectAbort
  const cancellation = new Promise((_, reject) => { rejectAbort = () => reject(controller.signal.reason); controller.signal.addEventListener('abort', rejectAbort, { once: true }) })
  const bounded = operation => {
   if (controller.signal.aborted) throw controller.signal.reason
   return Promise.race([Promise.resolve().then(operation), cancellation])
  }
  try {
   const retainedResponses = [], listingRecords = [], details = [], jobs = [], gaps = new Set(['whole-company-country-scope-unverified'])
   let totalBytes = 0
   const get = async url => {
    const response = await bounded(() => fetchImpl(url, { signal: controller.signal, redirect: 'manual' }))
    requireNative(response.status === 200, `native HTTP ${response.status}`)
    requireNative(response.url === url && response.redirected !== true, 'native redirect changed resource')
    const advertisedBytes = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(advertisedBytes) && advertisedBytes > 0) {
     requireNative(advertisedBytes <= maxResponseBytes, 'native response exceeds byte limit')
     requireNative(totalBytes + advertisedBytes <= maxTotalBytes, 'native aggregate body exceeds byte limit')
    }
    let body, responseBytes = 0
    const count = bytes => {
     responseBytes += bytes
     totalBytes += bytes
     requireNative(responseBytes <= maxResponseBytes, 'native response exceeds byte limit')
     requireNative(totalBytes <= maxTotalBytes, 'native aggregate body exceeds byte limit')
    }
    if (response.body?.getReader) {
     const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }), chunks = []
     try {
      while (true) {
       const chunk = await bounded(() => reader.read())
       if (chunk.done) break
       count(chunk.value.byteLength)
       chunks.push(decoder.decode(chunk.value, { stream: true }))
      }
      chunks.push(decoder.decode())
      body = chunks.join('')
     } catch (error) {
      try { Promise.resolve(reader.cancel(error)).catch(() => {}) } catch {}
      throw error
     } finally { try { reader.releaseLock() } catch {} }
    } else {
     body = await bounded(() => response.text())
     requireNative(typeof body === 'string', 'non-text native body')
     count(Buffer.byteLength(body))
    }
    requireNative(typeof body === 'string', 'non-text native body')
    retainedResponses.push({ url, finalUrl: response.url || url, status: response.status, capturedAt: now(), body, bodySHA256: createHash('sha256').update(body).digest('hex') })
    return active(body)
   }
   const listing = await get(CURRENT_CAREERS_URL)
   const identity = await get(IDENTITY_URL)
   requireNative(/DEXIT Global Limited\s*\(Formerly known as NSEIT Limited\)/i.test(identity.text(identity.root)), 'successor identity missing')
   const visited = new Set(), ids = new Set()
   let page = listing, url = CURRENT_CAREERS_URL
   while (page) {
    requireNative(!visited.has(url) && visited.size < 100, 'native pagination cycle/limit')
    visited.add(url)
    const wrap = one(page.nodes(n => page.hasClass(n, 'awsm-job-listings')), 'native listings')
    const rows = page.nodes(n => page.hasClass(n, 'awsm-job-listing-item'), wrap)
    requireNative(rows.length > 0, 'unverified empty native listing')
    for (const item of rows) {
     const id = /^awsm-list-item-(\d+)$/.exec(item.attrs.id || '')?.[1]
     requireNative(id && !ids.has(id), 'duplicate/missing native ID'); ids.add(id)
     const titleNode = one(page.nodes(n => page.hasClass(n, 'awsm-job-post-title'), item), 'listing title')
     const link = one(page.nodes(n => n.tag === 'a' && n.attrs.href, titleNode), 'listing link')
     const detailURL = firstParty(link.attrs.href)
     requireNative(new URL(detailURL).pathname.startsWith('/currentopenings/'), 'foreign role route')
     const locationNode = one(page.nodes(n => page.hasClass(n, 'awsm-job-specification-job-location'), item), 'listing location')
     listingRecords.push({ id, title: page.text(link), url: detailURL, location: page.text(locationNode) })
    }
    const next = page.nodes(n => n.tag === 'a' && page.hasClass(n, 'page-numbers') && page.hasClass(n, 'next'))
    requireNative(next.length <= 1, 'ambiguous native pagination')
    if (!next.length) break
    url = firstParty(new URL(next[0].attrs.href, url).href)
    requireNative(new URL(url).pathname.startsWith('/careers/'), 'foreign pagination route')
    page = await get(url)
   }
   for (const row of listingRecords) {
    const doc = await get(row.url)
    requireNative(doc.text(one(doc.nodes(n => n.tag === 'h1' && doc.hasClass(n, 'awsm-jobs-single-title')), 'visible role title')) === row.title, 'native title conflict')
    const schemas = []
    const walk = value => { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') { if (value['@type'] === 'JobPosting') schemas.push(value); if (value['@graph']) walk(value['@graph']) } }
    for (const script of doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')) walk(JSON.parse(script.raw))
    const posting = one(schemas, 'JobPosting')
    requireNative(posting.title === row.title && posting.hiringOrganization?.name === 'DEXIT Global Limited', 'native employer/title conflict')
    requireNative(doc.nodes(n => n.tag === 'form' && n.attrs.id === 'awsm-application-form').length === 1, 'missing native application form')
    const descriptionNodes = doc.nodes(n => doc.hasClass(n, 'awsm-job-entry-content'))
    const locationLabels = descriptionNodes.flatMap(node => doc.nodes(n => n.tag === 'p' && /^Location\s*:/i.test(doc.text(n)), node))
    requireNative(locationLabels.length <= 1 && locationLabels.every(node => doc.text(node).replace(/^Location\s*:\s*/i, '') === row.location), 'visible location conflict')
    let sourceDescription = null
    if (descriptionNodes.length === 1) {
     const node = descriptionNodes[0], text = doc.text(node)
     const substance = doc.nodes(n => ['li', 'p'].includes(n.tag), node).some(n => doc.text(n).length > 60 && !doc.nodes(c => ['strong', 'b', 'h1', 'h2', 'h3', 'h4'].includes(c.tag), n).some(c => doc.text(c) === doc.text(n)))
     if (substance && text.length >= 100) {
      requireNative(locationLabels.length === 1 && doc.text(locationLabels[0]).replace(/^Location\s*:\s*/i, '') === row.location, 'visible location conflict')
      sourceDescription = doc.inner(node)
      requireNative(active(posting.description || '').text(active(posting.description || '').root).replace(/\s/g, '') === text.replace(/\s/g, ''), 'schema/visible description conflict')
     }
    }
    if (!sourceDescription) gaps.add('native-description-missing')
    const locations = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]).map(location => {
     const address = location?.address, country = nativeCountryName(address?.addressCountry)
     if (address && typeof address === 'object') {
      const labelCountry = nativeLocationCountryName(address.addressLocality)
      requireNative(!labelCountry || !country || labelCountry === country, 'native country/locality conflict')
      requireNative(!(country === 'India' && /^(?:California|Texas|Ontario|New York|CA|TX|NY)$/i.test(address.addressRegion || '')), 'native country/state conflict')
     }
     return { address, country }
    })
    requireNative(locations.length > 0, 'missing job locations')
    const known = locations.every(location => location.country)
    if (!known) gaps.add('native-country-unresolved')
    // The existing public policy accepts a whole city label without inventing a
    // country. Require agreement from every native address and the listing;
    // conflicting/unsupported country or region metadata cannot use this path.
    const cityOnlyScope = !known && isNativeBareCityInPublicScope(row.location) && locations.every(({address,country}) => {
     if (country) return false
     const label = typeof address === 'string' ? address : address?.addressLocality
     if (typeof address === 'object' && address && [address.addressCountry,address.addressRegion].some(value => value != null && value !== '')) return false
     return isNativeBareCityInPublicScope(label) && label.trim().replace(/\s+/g,' ').toLowerCase() === row.location.trim().replace(/\s+/g,' ').toLowerCase()
    })
    const labelCountry = nativeLocationCountryName(row.location)
    requireNative(!labelCountry || locations.some(l => l.country === labelCountry), 'listing/native country conflict')
    const posted = publicDate(posting.datePosted), closing = publicDate(posting.validThrough)
    requireNative(!closing || !posted || +new Date(closing) >= +new Date(posted), 'closing date precedes publication')
    const fact = { ...row, sourceDescription, sourceDetailComplete: Boolean(sourceDescription), sourceDetailStatus: sourceDescription ? 'complete' : 'missing-description', nativeJobPosting: posting, nativePublicationDate: posted, closingDate: closing, legalEmployer: 'DEXIT Global Limited', locations }
    details.push(fact)
    const closingEnd = closing && /^\d{4}-\d\d-\d\d$/.test(closing) ? +new Date(closing) + 86400000 : +new Date(closing)
    if ((known && locations.some(l => l.country === 'India') || cityOnlyScope) && (!closing || closingEnd > +new Date(now())) && (!posted || +new Date(posted) <= +new Date(now()))) jobs.push({
     source: SOURCE, company: COMPANY_NAME, title: row.title, id: row.id, jobId: row.id, requisitionId: null,
     sourceUrl: row.url, applyUrl: row.url, link: row.url, country: cityOnlyScope ? null : 'India', location: row.location,
     city: cityOnlyScope ? getValidIndiaCityForJob({country:null,location:row.location}) : locations.find(l => l.country === 'India').address.addressLocality || null,
     jobDescription: sourceDescription, sourceDescription, postingDate: posted, postedAt: posted, closingDate: closing,
     sourceClosingDateIsExact: Boolean(closing && closing.includes('T')),
     nativePublicationDate: posted, nativeJobPosting: posting, legalEmployer: fact.legalEmployer,
     sourceDetailComplete: Boolean(sourceDescription), sourceDetailStatus: fact.sourceDetailStatus,
     sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    })
   }
   Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: { listingRecords, details, retainedResponses, pagesFetched: visited.size, observedListingCount: listingRecords.length } })
   return attachInventoryEvidence(jobs, { status: 'coverage-gap', firstParty: true, surface: CURRENT_CAREERS_URL, listingComplete: false, pagesFetched: visited.size, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(), reason: [...gaps].join(';') })
  } finally {
   clearTimeout(timer)
   signal?.removeEventListener('abort', abort)
   controller.signal.removeEventListener('abort', rejectAbort)
  }
 },
})
export const run = options => createNseitScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
 const jobs = await run()
 const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
 if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
 else await saveToDB(jobs, SOURCE)
}
