import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'talentsprint'
export const COMPANY_NAME = 'TalentSprint'
export const COMPANY = COMPANY_NAME
export const COMPANY_ID = 'main'
// This is the current corporate handoff observation date, not an inventory verification date.
export const VERIFIED_ON = '2026-10-26'
export const OFFICIAL_SITE_URL = 'https://talentsprint.com/'
export const CAREERS_PAGE_URL = 'https://talentsprint.com/careers/'
export const DARWINBOX_ORIGIN = 'https://talentsprint.darwinbox.in'
export const OFFICIAL_CAREERS_HANDOFF_URL = `${DARWINBOX_ORIGIN}/ms/candidate/careers`
export const PUBLIC_ALL_JOBS_URL = `${DARWINBOX_ORIGIN}/ms/candidatev2/${COMPANY_ID}/careers/allJobs`
export const PUBLIC_LISTING_GET_URL = `${DARWINBOX_ORIGIN}/ms/candidateapi/job/alljobs?companyId=${COMPANY_ID}`

const sameUrl = (left, right) => {
  try {
    const url = new URL(left), target = new URL(right)
    return !url.username && !url.password && !url.hash && url.origin === target.origin
      && url.pathname.replace(/\/+$/, '') === target.pathname.replace(/\/+$/, '') && url.search === target.search
  } catch { return false }
}
const hasOfficialCareersPageSignal = html => {
  const doc = readVisibleNativeDocument(String(html))
  return doc.nodes(n => n.tag === 'title').some(n => /talentsprint.*careers.*job opportunities/i.test(n.raw || ''))
    && doc.nodes(n => n.tag === 'h1').some(n => /Go Beyond the Ordinary/i.test(doc.text(n)))
}
export const extractDarwinboxHandoffUrl = (html = '') => {
  const doc = readVisibleNativeDocument(html)
  return doc.nodes(n => n.tag === 'a' && n.attrs.href)
    .filter(n => /view job openings|join our team/i.test(doc.text(n)))
    .map(n => { try { return new URL(n.attrs.href, CAREERS_PAGE_URL).href } catch { return null } })
    .find(url => sameUrl(url, OFFICIAL_CAREERS_HANDOFF_URL)) || null
}
export const hasOfficialCareersHandoffSignal = (html = '') => hasOfficialCareersPageSignal(html)
  && sameUrl(extractDarwinboxHandoffUrl(html), OFFICIAL_CAREERS_HANDOFF_URL)

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { method: 'GET', redirect: 'manual',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(30000)]) })
  return { status: response.status, url: response.url, html: await response.text() }
}
const officialFailure = message => {
  const error = new Error(message)
  error.abortRetries = true
  error.failureKind = 'parser_or_contract_error'
  throw error
}

export const createTalentSprintScraper = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, now = settings.now || (() => new Date().toISOString())
    const sleep = settings.sleep || (delay => new Promise(resolve => setTimeout(resolve, delay)))
    const fetchPage = settings.fetchPage || (settings.fetchText
      ? async (url, init) => ({ status: 200, url, html: await settings.fetchText(url, init) }) : defaultFetchPage)
    const requestedHosts = new Set()
    const request = async url => {
      settings.signal?.throwIfAborted()
      const host = new URL(url).hostname
      if (requestedHosts.has(host)) await sleep(1000)
      requestedHosts.add(host)
      settings.signal?.throwIfAborted()
      const page = await fetchPage(url, { signal: settings.signal, method: 'GET' })
      settings.signal?.throwIfAborted()
      return page
    }
    const gap = (surface, reason) => attachInventoryEvidence([], {
      status: 'coverage-gap', surface, firstParty: true, listingComplete: false,
      // No native inventory page or country facet was recovered. A blank page is not zero jobs.
      pagesFetched: 0, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: `${reason};native-closing-state-unverified`,
    })
    const official = await request(CAREERS_PAGE_URL)
    if (official?.status !== 200 || !sameUrl(official.url, CAREERS_PAGE_URL) || !hasOfficialCareersPageSignal(official.html)) {
      officialFailure('The verified TalentSprint careers page changed materially or is unavailable')
    }
    if (!sameUrl(extractDarwinboxHandoffUrl(official.html), OFFICIAL_CAREERS_HANDOFF_URL)) {
      officialFailure('The verified TalentSprint Darwinbox handoff changed materially')
    }

    // Current anonymous browser evidence has no active client on either board route.
    // Only the established public GET routes are checked; no POST contract is inferred.
    // Positive extraction remains unresolved until an employer-bound current client/inventory is available.
    for (const url of [OFFICIAL_CAREERS_HANDOFF_URL, PUBLIC_ALL_JOBS_URL, PUBLIC_LISTING_GET_URL]) {
      let page
      try { page = await request(url) } catch (error) {
        settings.signal?.throwIfAborted()
        return gap(url, [401, 403, 429].includes(error?.status)
          ? `native-public-access-denied-${error.status}` : 'native-public-route-unavailable')
      }
      if ([401, 403, 429].includes(page?.status)) return gap(url, `native-public-access-denied-${page.status}`)
      if (!sameUrl(page?.url, url)) return gap(url, 'native-route-identity-unverified')
      if (page?.status !== 200) {
        const tenantFailure = typeof page?.html === 'string' && /Error while getting tenant info/.test(page.html)
        return gap(url, `talentsprint-native-public-listing-http-${page?.status || 'unknown'}${tenantFailure ? ';native-tenant-unavailable' : ''}`)
      }
      if (typeof page.html !== 'string' || !page.html.trim()) return gap(url, 'native-public-body-unavailable')
    }
    return gap(PUBLIC_LISTING_GET_URL, 'native-inventory-extraction-unresolved')
  },
})
export const run = async (options = {}) => createTalentSprintScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
