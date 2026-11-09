import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { ESDS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
export const SOURCE = ESDS_CATALOG.source
export const COMPANY = ESDS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ESDS_CATALOG.officialBrandName
export const VERIFIED_ON = ESDS_CATALOG.verifiedOn
export const HOMEPAGE_URL = ESDS_CATALOG.officialHomepageUrl
export const CAREERS_URL = ESDS_CATALOG.officialCareersLandingUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = ESDS_CATALOG.officialCareersHandoffUrl
export const DARWINBOX_ORIGIN = ESDS_CATALOG.darwinboxOrigin
export const DARWINBOX_COMPANY_ID = ESDS_CATALOG.darwinboxCompanyId
export const PUBLIC_PORTAL_URL = ESDS_CATALOG.publicAllJobsUrl
export const PROVIDER_METADATA = ESDS_CATALOG

const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim() || null
const allowedHosts = new Set(['www.esds.co.in', 'esds.co.in', 'esds.darwinbox.in'])
const deniedStatuses = new Set([401, 403, 429])
const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
const toUrl = (value, base = CAREERS_URL) => {
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'https:' || url.username || url.password || !allowedHosts.has(url.hostname)) return null
    url.hash = ''
    return url.toString()
  } catch { return null }
}
const listingUrl = value => {
  const url = toUrl(value)
  if (!url || !/^\/(?:esds-peoples\/)?careers\/?$/.test(new URL(url).pathname)) return null
  return url === CAREERS_URL ? url : url.replace(/\/$/, '')
}
export const buildDetailUrl = jobId => `${HOMEPAGE_URL}career-details/${encodeURIComponent(normalize(jobId) || '')}`

export const hasOfficialCareersSignal = html => {
  const document = readVisibleNativeDocument(html)
  return activeHead(html).titles.includes('Careers at ESDS | IT and Cloud Job Opportunities')
    && document.nodes(node => /^h[12]$/.test(node.tag)).some(node => /Find your Next Job|Life at ESDS/i.test(document.text(node)))
    && document.nodes(node => /^h[1-6]$/.test(node.tag)).some(node => /^Jobs of the day$/i.test(document.text(node)))
}

export const extractJobCards = html => {
  const document = readVisibleNativeDocument(html)
  return document.nodes(node => /window\.location\s*=/.test(node.attrs.onclick || '')).map(node => {
    const route = node.attrs.onclick.match(/window\.location\s*=\s*['"]([^'"]+)['"]/)?.[1]
    const sourceUrl = toUrl(route)
    const match = sourceUrl && new URL(sourceUrl).pathname.match(/^\/career-details\/([a-zA-Z0-9_-]+)\/?$/)
    if (!match || new URL(sourceUrl).hostname !== 'www.esds.co.in') return null
    const titleNodes = descendants(node, child => child.tag === 'h5')
    const locationNodes = descendants(node, child => child.tag === 'p' && document.hasClass(child, 'm-0'))
    if (titleNodes.length !== 1 || locationNodes.length !== 1) return null
    const title = document.text(titleNodes[0]), location = document.text(locationNodes[0])
    const fields = new Map(descendants(node, child => child.tag === 'li').map(child => {
      const text = document.text(child), at = text.indexOf(':')
      return at < 0 ? [] : [normalize(text.slice(0, at))?.toLowerCase(), normalize(text.slice(at + 1))]
    }).filter(entry => entry.length === 2))
    const jobId = match[1]
    if (!title || !location || fields.get('job id') !== jobId || sourceUrl.replace(/\/$/, '') !== buildDetailUrl(jobId)) return null
    return {
      jobId, title, company: COMPANY, location, country: null, requisitionId: null,
      postingDate: null, closingDate: null, jobDescription: null,
      department: fields.get('department') || null,
      experienceRequired: fields.get('experience (years)') || null,
      sourceUrl, applyUrl: null,
    }
  }).filter(Boolean)
}

// A 200 response containing only ESDS Open Graph metadata is neither a job nor a
// working application client. Unexpected content requires a fresh contract review.
export const hasOfficialJobDetailSignal = () => false
const classifyDetail = html => {
  const document = readVisibleNativeDocument(html)
  const bodies = document.nodes(node => node.tag === 'body')
  const text = bodies.length === 1 ? document.text(bodies[0]) : ''
  if (activeHead(html).titles.includes('ESDS') && /^ESDS\s*-?\s*$/.test(text)) return 'metadata-only-public-detail'
  return 'unverified-public-detail-contract'
}

const advertisedRoutes = html => {
  const document = readVisibleNativeDocument(html)
  const routes = document.nodes(node => node.tag === 'a' || node.tag === 'form').flatMap(node => {
    const value = node.tag === 'form' ? node.attrs.action : node.attrs.href
    const url = toUrl(value)
    if (!url || (node.tag === 'form' && (node.attrs.method || 'get').toLowerCase() !== 'get')) return []
    const listing = listingUrl(url)
    if (listing) return [{ kind: 'corporate-listing', url: listing }]
    if (new URL(url).hostname === 'esds.darwinbox.in' && /\/careers(?:\/|$)/i.test(new URL(url).pathname)) return [{ kind: 'native-hiring-route', url }]
    return []
  })
  return [...new Map(routes.map(route => [route.url, route])).values()]
}

// Single-attempt, anonymous GETs only. Redirects receive the same host spacing
// and access-denial handling as the initial URL; no fallback session or headers.
export const createPublicGetTransport = ({ fetchImpl = fetch, spacingMs = 1100 } = {}) => {
  const lastRequestAt = new Map()
  let denied = false
  return async (initialUrl, { signal } = {}) => {
    let url = toUrl(initialUrl)
    for (let hop = 0; hop <= 5; hop += 1) {
      signal?.throwIfAborted()
      if (!url || denied) throw new Error('[esds] public GET stopped by URL or access-denial guard')
      const host = new URL(url).hostname
      const delay = Math.max(0, Math.max(1000, spacingMs) - (Date.now() - (lastRequestAt.get(host) || 0)))
      if (delay) await new Promise(resolve => setTimeout(resolve, delay))
      signal?.throwIfAborted()
      lastRequestAt.set(host, Date.now())
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) })
      if (deniedStatuses.has(response.status)) denied = true
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const nextUrl = toUrl(response.headers.get('location'), url)
        await response.body?.cancel?.()
        if (!nextUrl) throw new Error('[esds] public redirect left the verified employer hosts')
        url = nextUrl
        continue
      }
      return { status: response.status, url, text: await response.text() }
    }
    throw new Error('[esds] public redirect limit exceeded')
  }
}

export const createEsdsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage, fetchText, maxPages = config.maxPages || 10, signal, onSourceEvidence } = {}) {
    const transport = fetchPage || (fetchText ? async url => ({ status: 200, url, text: await fetchText(url) }) : createPublicGetTransport())
    const evidence = { source: SOURCE, codeRepaired: false, partial: true, observedAt: now(),
      advertisedCandidates: [], listingPages: [], details: [], advertisedHiringRoutes: [], issues: ['native-inventory-and-role-country-unverified'] }
    const pages = new Map(), candidates = new Map(), queue = [CAREERS_URL]
    let stopped = false
    const read = async url => {
      signal?.throwIfAborted()
      try {
        const page = await transport(url, { signal })
        if (!page || typeof page.text !== 'string' || !Number.isInteger(page.status) || !toUrl(page.url || url)) throw new Error('invalid-response')
        if (deniedStatuses.has(page.status)) { stopped = true; evidence.issues.push('access-denied') }
        return page
      } catch (error) {
        signal?.throwIfAborted()
        evidence.issues.push(deniedStatuses.has(error.status) ? 'access-denied' : 'public-fetch-failed')
        stopped = true
        return null
      }
    }
    for (let index = 0; index < queue.length && !stopped; index += 1) {
      if (index >= maxPages) { evidence.issues.push('corporate-pagination-limit'); break }
      const url = queue[index], page = await read(url)
      if (!page) break
      evidence.listingPages.push({ url, finalUrl: page.url || url, status: page.status })
      if (page.status !== 200 || !hasOfficialCareersSignal(page.text)) { evidence.issues.push('unverified-corporate-listing'); break }
      const cards = extractJobCards(page.text)
      pages.set(url, JSON.stringify(cards))
      for (const card of cards) {
        if (candidates.has(card.jobId) && JSON.stringify(candidates.get(card.jobId)) !== JSON.stringify(card)) evidence.issues.push('contradictory-corporate-candidate')
        candidates.set(card.jobId, card)
      }
      for (const route of advertisedRoutes(page.text)) {
        if (!evidence.advertisedHiringRoutes.some(item => item.url === route.url)) evidence.advertisedHiringRoutes.push(route)
        if (route.kind === 'corporate-listing' && !queue.includes(route.url)) queue.push(route.url)
        if (route.kind === 'native-hiring-route') evidence.issues.push('unverified-advertised-native-hiring-route')
      }
    }
    evidence.advertisedCandidates = [...candidates.values()]
    if (!candidates.size) evidence.issues.push('corporate-candidates-missing-or-changed')
    for (const candidate of candidates.values()) {
      if (stopped) break
      const page = await read(candidate.sourceUrl)
      evidence.details.push({ jobId: candidate.jobId, url: candidate.sourceUrl, finalUrl: page?.url || null,
        status: page?.status || null, outcome: !page ? 'public-fetch-failed' : deniedStatuses.has(page.status) ? 'access-denied' : page.status !== 200 ? 'public-detail-unavailable' : classifyDetail(page.text) })
    }
    // Closing discovery checks happen before any output cap. They cannot prove
    // the native inventory complete while the advertised public client is absent.
    if (!stopped) for (const [url, opening] of pages) {
      const page = await read(url)
      if (!page || stopped) break
      if (page.status !== 200 || !hasOfficialCareersSignal(page.text) || JSON.stringify(extractJobCards(page.text)) !== opening
          || advertisedRoutes(page.text).some(route => !evidence.advertisedHiringRoutes.some(item => item.url === route.url))) evidence.issues.push('closing-corporate-inventory-changed')
    }
    evidence.issues = [...new Set([...evidence.issues, ...evidence.details.map(detail => detail.outcome)])]
    onSourceEvidence?.(evidence)
    return attachInventoryEvidence([], { status: 'discovery-only', surface: CAREERS_URL,
      firstParty: pages.size > 0, listingComplete: false, pagesFetched: pages.size,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: evidence.observedAt,
      reason: `esds-unresolved-coverage-gap:${evidence.issues.join(',')}` })
  },
})

export const run = options => createEsdsScraper(options).run(options)
