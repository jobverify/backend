import { decodeNativeEntities, readNativeAttributeTokens } from '../../scraper-support/utils/activeNativeHtml.js'
import { readInventoryEvidence, attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument, readNativeStatusLayout } from '../../scraper-support/utils/visibleNativeHtml.js'
import { explicitWorkdayCountryScope, hasRecognizedWorkdayCountry } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import {
  APPLIED_CLOUD_COMPUTING_CATALOG,
  BOARD_URL,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APPLIED_CLOUD_COMPUTING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export { BOARD_URL }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createApiProvider = () => ({
  ...PROVIDER_METADATA,
  config: {
    ...PROVIDER_METADATA.config,
    mapping: { ...PROVIDER_METADATA.config.mapping, country: 'location.country' },
    resultFilter: { ...PROVIDER_METADATA.config.resultFilter, include: [] },
  },
})

// Opening-token provenance only. Keep the shared reader's ASCII tag/attribute
// boundaries and raw-body exclusions; do not search past malformed bytes into
// a synthetic href. The shared tokenizer still owns attribute names/values.
const anchorOpeningAttributes = html => {
  const space = value => value !== undefined && /[\t\n\f\r ]/.test(value)
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'])
  const anchors = []
  let cursor = 0
  while ((cursor = html.indexOf('<', cursor)) !== -1) {
    if (html.startsWith('<!--', cursor)) {
      const end = html.indexOf('-->', cursor + 4)
      cursor = end === -1 ? html.length : end + 3
      continue
    }
    if (html.startsWith('<?', cursor) || html.startsWith('<!', cursor)) {
      const end = html.indexOf('>', cursor + 2)
      cursor = end === -1 ? html.length : end + 1
      continue
    }
    let first = cursor + 1
    const closing = html[first] === '/'
    if (closing) first++
    if (!/[A-Za-z]/.test(html[first] || '')) { cursor++; continue }
    let at = first
    while (at < html.length && !space(html[at]) && !['/', '>'].includes(html[at])) at++
    const tag = html.slice(first, at).replace(/[A-Z]/g, value => value.toLowerCase()), attributesAt = at
    while (at < html.length && html[at] !== '>') {
      if (space(html[at]) || html[at] === '/') { at++; continue }
      const nameAt = at
      if (html[at] === '=') at++
      while (at < html.length && !space(html[at]) && !['/', '=', '>'].includes(html[at])) at++
      if (at === nameAt) return null
      while (space(html[at])) at++
      if (html[at] === '=') {
        at++
        while (space(html[at])) at++
        if (html[at] === '"' || html[at] === "'") {
          const end = html.indexOf(html[at], at + 1)
          if (end === -1) return null
          at = end + 1
        } else while (at < html.length && !space(html[at]) && html[at] !== '>') at++
      }
    }
    if (at >= html.length) return null
    cursor = at + 1
    if (!closing && tag === 'a') anchors.push(html.slice(attributesAt, at))
    if (!closing && raw.has(tag)) {
      if (tag === 'plaintext') break
      const end = new RegExp('</' + tag + '[\\t\\n\\f\\r ]*>', 'ig')
      end.lastIndex = cursor
      const match = end.exec(html)
      cursor = match ? end.lastIndex : html.length
    }
  }
  return anchors
}

export const hasVerifiedBoardSignal = (html = '') => {
  if (typeof html !== 'string' || !html) return false
  try {
    const document = readVisibleNativeDocument(html, { strict: true, statusLayout: true })
    const parents = new Map(), anchors = []
    const index = node => {
      if (node.tag === 'a') anchors.push(node)
      for (const child of node.children || []) if (typeof child !== 'string') { parents.set(child, node); index(child) }
    }
    document.statusNodes(node => node.tag === 'root').forEach(index)
    const attributes = anchorOpeningAttributes(html)
    if (!attributes || attributes.length !== anchors.length) return false
    const provenance = new Map(anchors.map((node, at) => [node, attributes[at]]))
    const excluded = node => readNativeStatusLayout(node)?.stronglyExcluded === true
    const unsafe = node => Object.keys(node.attrs).some(name => /^on/i.test(name))
      || ['disabled', 'download'].some(name => Object.hasOwn(node.attrs, name)) || node.attrs['aria-disabled'] === 'true'
    const qualified = node => {
      const layout = readNativeStatusLayout(node)
      return !node.inert && layout?.qualified === true && layout.visibility === 'visible'
        && !unsafe(node) && node.children.every(child => typeof child === 'string' || excluded(child) || qualified(child))
    }
    const enabled = node => { for (let current = node; current; current = parents.get(current)) if (unsafe(current)) return false; return qualified(node) }
    const headings = document.statusNodes(node => (node.tag === 'h1' || node.tag === 'h2') && normalizeWhitespace(document.text(node)))
    if (headings.some(node => !enabled(node))) return false
    const h1 = headings.filter(node => node.tag === 'h1')
    const h2 = headings.filter(node => node.tag === 'h2').map(node => normalizeWhitespace(document.text(node)))
    const links = document.statusNodes(node => node.tag === 'a' && node.attrs.href === HOMEPAGE_URL && !excluded(node))
    if (h1.length !== 1 || normalizeWhitespace(document.text(h1[0])) !== COMPANY
      || !['Careers at ' + COMPANY, 'Jobs at ' + COMPANY].every(title => h2.filter(value => value === title).length === 1)
      || links.length !== 1 || !enabled(links[0]) || normalizeWhitespace(document.text(links[0])) !== COMPANY) return false
    const hrefs = readNativeAttributeTokens(provenance.get(links[0])).filter(([name]) => name === 'href')
    return hrefs.length === 1 && decodeNativeEntities(hrefs[0][1]) === HOMEPAGE_URL
  } catch { return false }
}

// Caller cancellation stays authoritative even when a supplied reader ignores its signal.
const withAppliedSignal = async (signal, operation) => {
  signal?.throwIfAborted()
  if (!signal) return operation()
  let onAbort
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }),
      aborted,
    ])
    signal.throwIfAborted()
    return value
  } catch (error) {
    signal.throwIfAborted()
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  signal: options.signal,
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: BOARD_URL,
    ...(options.headers || {}),
  },
  body: options.body,
  label: SOURCE,
  timeoutMs: 15000,
})

const ownershipError = message => Object.assign(new Error('Applied Cloud Computing ' + message), {
  code: 'APPLIED_CLOUD_OWNERSHIP_MISMATCH', incompleteScope: true, abortRetries: true,
})
const needOwned = (condition, message) => { if (!condition) throw ownershipError(message) }
const data = (record, key) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  needOwned(!descriptor || Object.hasOwn(descriptor, 'value'), 'native identity accessor is unqualified')
  return descriptor?.value
}
const assertPublicationState = record => {
  needOwned(record && typeof record === 'object' && !Array.isArray(record), 'native record is malformed')
  if (Object.hasOwn(record, 'active')) needOwned(data(record, 'active') === true, 'native role is explicitly inactive')
  if (Object.hasOwn(record, 'visibility')) needOwned(data(record, 'visibility') === 'PUBLIC', 'native role is not public')
}
const API_URL = PROVIDER_METADATA.config.discovery.listingApiUrl
const ACCOUNT = new URL(API_URL).pathname.match(/^\/v1\/companies\/([^/]+)\/postings$/)[1]
const idValue = id => typeof id === 'string' && /^[1-9]\d*$/.test(id)
const regionCodes = new Set('AN AP AR AS BR CG CH DD DL DN GA GJ HR HP JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UP UK UT WB'.split(' '))
const nativeCountry = record => {
  const location = data(record, 'location'), country = data(location, 'country')
  const code = typeof country === 'string' && /^[a-z]{2}$/i.test(country) && hasRecognizedWorkdayCountry(country) ? country.toLowerCase() : null
  const scope = code === 'in' ? 'india' : 'foreign', full = data(location, 'fullLocation'), city = data(location, 'city')
  needOwned(full == null || typeof full === 'string', 'native location label is malformed')
  if (!code) return null
  for (const token of String(full || '').split(',').map(value => value.trim()).filter(Boolean)) {
    if (typeof city === 'string' && token === city.trim() || code === 'in' && /(?:^|,)\s*(?:India|IN)\s*$/i.test(full || '') && regionCodes.has(token.toUpperCase())) continue
    const explicit = explicitWorkdayCountryScope(token)
    needOwned(!explicit || explicit === scope, 'native country conflicts with an explicit location country')
  }
  return code
}
const roleURL = (value, id) => {
  needOwned(typeof value === 'string' && value.length > 0 && !/[\s\\\u0000-\u001f\u007f]/.test(value), 'native role URL is missing or malformed')
  let url; try { url = new URL(value) } catch { throw ownershipError('native role URL is malformed') }
  needOwned(url.href === value && url.origin === 'https://jobs.smartrecruiters.com' && !url.username && !url.password && !url.port && !url.hash,
    'native role URL leaves the declared SmartRecruiters origin')
  needOwned(url.pathname.startsWith('/' + ACCOUNT + '/' + id + '-') && url.pathname.split('/').length === 3
    && url.pathname.length > ('/' + ACCOUNT + '/' + id + '-').length && !/%(?:2f|5c|00|0[ad9])/i.test(url.pathname)
    && ['', '?oga=true'].includes(url.search), 'native role URL conflicts with its account or posting ID')
  return url
}
const publicationUUID = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
const assertReferral = record => {
  if (!Object.hasOwn(record, 'referralUrl')) return
  const uuid = data(record, 'uuid')
  needOwned(publicationUUID(uuid) && data(record, 'referralUrl') === 'https://jobs.smartrecruiters.com/external-referrals/company/'
    + ACCOUNT + '/publication/' + uuid + '?dcr_ci=' + ACCOUNT, 'native referral publication/account conflicts')
}
const assertDetailNativeFields = (listing, detail, id) => {
  for (const field of ['uuid', 'jobAdId']) {
    if (Object.hasOwn(listing, field) || Object.hasOwn(detail, field)) {
      const expected = data(listing, field), observed = data(detail, field)
      needOwned(publicationUUID(expected) && observed === expected, 'native detail ' + field + ' conflicts with its listing')
    }
  }
  if (Object.hasOwn(listing, 'defaultJobAd') || Object.hasOwn(detail, 'defaultJobAd')) {
    const expected = data(listing, 'defaultJobAd')
    needOwned(typeof expected === 'boolean' && data(detail, 'defaultJobAd') === expected, 'native default advertisement conflicts')
  }
  // The internal jobId is a separate native namespace. Its absence from the
  // listing does not make it equal to the posting id or publication UUID.
  const expectedJob = data(listing, 'jobId'), observedJob = data(detail, 'jobId')
  if (expectedJob != null && observedJob != null) needOwned(expectedJob === observedJob, 'native internal job identity conflicts')
  if (Object.hasOwn(detail, 'ref')) needOwned(data(detail, 'ref') === API_URL + '/' + id, 'native detail ref conflicts')
  const expectedDate = data(listing, 'releasedDate'), observedDate = data(detail, 'releasedDate')
  if (expectedDate != null && Object.hasOwn(detail, 'releasedDate')) needOwned(observedDate === expectedDate, 'native detail publication date conflicts')
  assertReferral(detail)
}
const createOwnedFetchJson = fetchJson => {
  const listings = new Map()
  const request = async (value, options) => {
    needOwned(typeof value === 'string', 'native request URL is malformed')
    let url; try { url = new URL(value) } catch { throw ownershipError('native request URL is malformed') }
    const listing = url.origin + url.pathname === API_URL
    const id = listing ? null : value.startsWith(API_URL + '/') ? value.slice((API_URL + '/').length) : null
    needOwned(url.href === value && !url.username && !url.password && !url.hash && (listing || idValue(id)), 'native request leaves the declared account')
    if (!listing) needOwned(listings.has(id), 'detail has no matching native listing')
    const payload = await fetchJson(value, options)
    if (listing) {
      const rows = data(payload, 'content')
      needOwned(Array.isArray(rows), 'native listing array is missing')
      for (const row of rows) {
        assertPublicationState(row)
        const id = data(row, 'id'), name = data(row, 'name'), company = data(row, 'company')
        needOwned(idValue(id) && !listings.has(id), 'native listing ID is missing, aliased or repeated')
        needOwned(data(company, 'identifier') === ACCOUNT, 'native listing company conflicts with the declared account')
        needOwned(data(row, 'ref') === API_URL + '/' + id, 'native listing ref conflicts with its account or ID')
        needOwned(typeof name === 'string' && name.trim(), 'native listing title is missing')
        for (const field of ['postingUrl', 'applyUrl']) if (Object.hasOwn(row, field)) roleURL(data(row, field), id)
        assertReferral(row)
        listings.set(id, { id, name, requisition: data(row, 'refNumber'), country: nativeCountry(row), listingLocation: data(row, 'location'), native: row })
      }
    } else {
      assertPublicationState(payload)
      const expected = listings.get(id), name = data(payload, 'name'), company = data(payload, 'company')
      needOwned(data(payload, 'id') === id, 'native detail posting ID conflicts with its listing')
      needOwned(name === undefined || name === expected.name, 'native detail title conflicts with its listing')
      if (Object.hasOwn(payload, 'company')) needOwned(company && typeof company === 'object' && !Array.isArray(company)
        && data(company, 'identifier') === ACCOUNT, 'native detail company conflicts with the declared account')
      assertDetailNativeFields(expected.native, payload, id)
      const requisition = data(payload, 'refNumber')
      needOwned(requisition == null || expected.requisition == null || requisition === expected.requisition, 'native requisition conflicts with its listing')
      const country = nativeCountry(payload)
      needOwned(country === null || expected.country === null || country === expected.country, 'native detail country conflicts with its listing')
      expected.country = country === null || expected.country === null ? null : country
      expected.detailLocation = data(payload, 'location')
      const postingValue = data(payload, 'postingUrl'), applyValue = data(payload, 'applyUrl')
      const posting = postingValue == null ? null : roleURL(postingValue, id), apply = applyValue == null ? null : roleURL(applyValue, id)
      needOwned(posting || apply, 'native detail has no owned public role URL')
      needOwned(!posting || !apply || posting.pathname === apply.pathname, 'native posting and application URLs conflict')
    }
    return payload
  }
  return { request, listings }
}

export const createAppliedCloudComputingScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    const boardHtml = await withAppliedSignal(signal, () => fetchText(BOARD_URL, { signal }))
    if (!hasVerifiedBoardSignal(boardHtml)) {
      throw ownershipError('verified SmartRecruiters board no longer matches the trusted exact-name contract')
    }

    const owned = createOwnedFetchJson((value, options = {}) => withAppliedSignal(options.signal || signal, () => fetchJson(value, options)))
    const jobs = await runApiPortalScraper({
      provider: createApiProvider(),
      signal,
      fetchJson: owned.request,
    })

    signal?.throwIfAborted()
    const unresolved = [...owned.listings.values()].some(row => row.country === null)
    const mapped = mapJobsWithInventoryEvidence(jobs, job => {
      const native = owned.listings.get(String(job.jobId))
      return {
        ...job,
        country: native.country === 'in' ? 'India' : native.country,
        ...(native.country === null ? {
          country: null, location: null, city: null, state: null, nativeGeographyQualified: false,
          sourceNativeWorkplace: { listing: native.listingLocation, detail: native.detailLocation ?? null },
        } : {}),
        ...(unresolved ? { sourceListingComplete: false } : {}),
        department: typeof job.department === 'string' ? job.department : null,
      }
    })
    const retained = mapped.filter(job => job.country === 'India' || job.country === null)
    const evidence = readInventoryEvidence(mapped)
    if (evidence) attachInventoryEvidence(retained, unresolved ? {
      ...evidence, status: 'discovery-only', listingComplete: false, indiaFacetCount: null,
      reason: 'Applied native country is missing or unresolved; ' + evidence.reason,
    } : { ...evidence, indiaFacetCount: retained.length })
    return retained.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createAppliedCloudComputingScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
