import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'bmwtechworksindia'
export const COMPANY = 'BMW TechWorks India'
export const VERIFIED_ON = '2026-10-08'
export const HOMEPAGE_URL = 'https://www.bmwtechworks.in/'
export const CAREERS_PAGE_URL = 'https://www.bmwtechworks.in/careers/'
export const AUTHORITY_POST_URL = 'https://www.linkedin.com/posts/bmw-techworks-india_bmwtechworksindia-bmwgroup-hiring-activity-7356277931834253313-1uyS'
export const RECRUITMENT_HANDOFF_URL = 'https://bit.ly/45qB9gC'
export const PORTAL_ORIGIN = 'https://careers-bmwtechworks.peoplestrong.com'
export const JOB_LISTINGS_URL = PORTAL_ORIGIN + '/job/joblist'
export const DEFAULT_PAGE_SIZE = 45
export const DEFAULT_DETAIL_CONCURRENCY = 6
const PUBLIC_API_BASE = PORTAL_ORIGIN + '/api/cp/rest/altone/cp/'
const LEGAL_EMPLOYER = 'BMW TechWorks India Pvt. Ltd.'
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })
// ISO 3166 countries/territories only: ICU also names unknown and pseudo regions.
const ISO_COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const countryNames = new Set(ISO_COUNTRY_CODES.map((code) => regionNames.of(code)?.toLowerCase()).filter(Boolean))
const DETAIL_PARTS = 'basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied'

const fail = (message) => {
  const error = new Error('BMW TechWorks India ' + message)
  error.code = 'BMW_TECHWORKS_INVENTORY_UNVERIFIED'
  throw error
}

const normalizeText = (value) => String(value ?? '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => Number.parseInt(code, 16) <= 0x10ffff ? String.fromCodePoint(Number.parseInt(code, 16)) : ' ')
  .replace(/\s+/g, ' ')
  .trim()

const assertNotAborted = (signal) => signal?.throwIfAborted()
const sameUrl = (actual, expected) => {
  try {
    const url = new URL(actual)
    const reference = new URL(expected)
    return url.origin === reference.origin && url.pathname === reference.pathname && !url.username && !url.password
  } catch { return false }
}

const request = async (url, options = {}) => withRetry(async () => {
  assertNotAborted(options.signal)
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
    : AbortSignal.timeout(20000)
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': USER_AGENT, ...options.headers },
    redirect: 'follow',
    signal,
  })
  if (!response.ok) {
    const error = new Error('HTTP ' + response.status + ' for ' + response.url)
    error.code = 'UPSTREAM_HTTP_ERROR'
    error.status = error.statusCode = response.status
    error.url = response.url
    throw error
  }
  const body = await response.text()
  assertNotAborted(options.signal)
  return { status: response.status, finalUrl: response.url, body }
}, { attempts: 2, baseDelayMs: 500, label: SOURCE, signal: options.signal })

const defaultFetchPage = async (url, options) => {
  const response = await request(url, { ...options, headers: { Accept: 'text/html,application/xhtml+xml' } })
  return { ...response, html: response.body }
}
const defaultFetchJson = async (url, options = {}) => {
  const response = await request(url, options)
  if (!sameUrl(response.finalUrl, url)) fail('public API redirected away from its verified contract')
  try { return JSON.parse(response.body) } catch { return fail('public API returned invalid JSON') }
}

export const buildJobsApiUrl = (offset = 0, limit = DEFAULT_PAGE_SIZE) => PUBLIC_API_BASE + 'jobs/v1?offset=' + offset + '&limit=' + limit
export const buildJobDetailsApiUrl = (code) => PUBLIC_API_BASE + 'job/' + encodeURIComponent(code) + '/v2?part=' + DETAIL_PARTS + '&isReqId=false'

export const hasOfficialPublisherHandoff = (html) => {
  const scripts = String(html ?? '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, raw] of scripts) {
    let posting
    try { posting = JSON.parse(raw) } catch { continue }
    if (posting?.['@type'] !== 'SocialMediaPosting' || posting?.['@id'] !== AUTHORITY_POST_URL
      || posting?.author?.['@type'] !== 'Organization' || posting?.author?.name !== COMPANY
      || !sameUrl(posting?.author?.url, 'https://in.linkedin.com/company/bmw-techworks-india')) continue
    const links = String(posting.articleBody ?? '').match(/https?:\/\/[^\s<>"']+/g) ?? []
    if (links.some((link) => {
      try { const url = new URL(link); return url.hostname === 'bit.ly' && url.pathname === '/45qB9gC' && !url.username && !url.password } catch { return false }
    })) return true
  }
  return false
}

const assertPublicTenant = (urlinfo, layout) => {
  const info = urlinfo?.response
  const brandText = normalizeText(JSON.stringify(layout?.response))
  if (urlinfo?.messageCode?.code !== 200 || info?.url !== new URL(PORTAL_ORIGIN).hostname || info.realm !== 1301
    || !/^https:\/\/static\.peoplestrong\.com\/.*tenant_1229\/org_1301\/logo\/BTWI /i.test(String(info.leftLogo ?? ''))
    || layout?.messageCode?.code !== 200 || !Array.isArray(layout.response)
    || !brandText.includes('BMW TechWorks India') || !brandText.includes('Tata Technologies') || !brandText.includes('BMW Group')) {
    fail('public tenant identity or employer branding changed')
  }
}

const locationParts = (value) => {
  const raw = String(value ?? '')
  const parts = raw.split('>').map(normalizeText)
  if (parts.length < 3 || parts.some((part) => !part) || !countryNames.has(parts[0].toLowerCase())) fail('listing location lacks an explicit country hierarchy')
  return parts
}
const assertListing = (row) => {
  if (!row || typeof row !== 'object' || !normalizeText(row.jobTitle) || !normalizeText(row.jobCode)
    || !/^BTWI\/[^/]+\/\d+$/.test(row.jobCode)) fail('listing identity or title is malformed')
  if (String(row.organizationUnitComplete ?? '').split('>')[0] !== LEGAL_EMPLOYER) fail('listing employer identity does not match BMW TechWorks India')
  locationParts(row.locationHierarchyComplete)
  if (!sameUrl(row.jobDetailUrl, PORTAL_ORIGIN + '/job/detail/' + row.jobCode.replaceAll('/', '_'))) fail('listing application URL does not identify the verified requisition')
}
const assertDetail = (listing, payload) => {
  const detail = payload?.response
  if (payload?.messageCode?.code !== 200 || !detail || typeof detail !== 'object'
    || detail.requisitionCode !== listing.jobCode || detail.jobTitle !== listing.jobTitle
    || String(detail.requisitionId) !== listing.jobCode.split('/').at(-1) || String(detail.entityID) !== '1574'
    || detail.organizationUnitComplete !== listing.organizationUnitComplete
    || detail.locationHierarchyComplete !== listing.locationHierarchyComplete
    || detail.requisitionStatus !== 'OPEN') fail('detail identity, employer, open status or location conflicts with the listing')
  if (!normalizeText(detail.jobDescription)) fail('detail published description is missing')
  return detail
}

const mapJob = (listing, detail, scrapedAt) => {
  const parts = locationParts(detail.locationHierarchyComplete)
  const country = parts[0]
  const rest = parts.slice(1).filter((part, index, values) => part !== values[index - 1]).reverse()
  return {
    title: normalizeText(listing.jobTitle),
    company: COMPANY,
    companyName: COMPANY,
    source: SOURCE,
    jobId: listing.jobCode,
    requisitionId: String(detail.requisitionId),
    sourceUrl: listing.jobDetailUrl,
    applyUrl: listing.jobDetailUrl,
    link: listing.jobDetailUrl,
    location: [...rest, country].join(', '),
    city: parts.at(-1),
    country,
    department: normalizeText(listing.organizationUnit) || null,
    employmentType: normalizeText(detail.employmentType) || null,
    experienceRequired: normalizeText(listing.expRange) || null,
    minimumExperience: detail.minimumExp == null || detail.minimumExp === '' || !Number.isFinite(Number(detail.minimumExp)) ? null : Number(detail.minimumExp),
    maximumExperience: detail.maximumExp == null || detail.maximumExp === '' || !Number.isFinite(Number(detail.maximumExp)) ? null : Number(detail.maximumExp),
    requiredSkills: [...new Set((Array.isArray(detail.skills) ? detail.skills : []).map((skill) => normalizeText(skill.text)).filter(Boolean))],
    postingDate: normalizeText(listing.jobPostedDate) || null,
    closingDate: normalizeText(listing.jobClosureDate) || null,
    jobDescription: normalizeText(detail.jobDescription),
    jobDescriptionHtml: detail.jobDescription,
    sourceListingComplete: true,
    scrapedAt,
  }
}

export const createBmwTechWorksIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson, pageSize = DEFAULT_PAGE_SIZE,
    detailConcurrency = DEFAULT_DETAIL_CONCURRENCY, maxPages = 500, signal } = {}) {
    assertNotAborted(signal)
    if (![15, 30, 45].includes(pageSize) || !Number.isSafeInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 12
      || !Number.isSafeInteger(maxPages) || maxPages < 1) fail('inventory pagination or concurrency options are invalid')
    const publisher = await fetchPage(AUTHORITY_POST_URL, { signal })
    assertNotAborted(signal)
    if (publisher?.status !== 200 || !sameUrl(publisher.finalUrl, AUTHORITY_POST_URL) || !hasOfficialPublisherHandoff(publisher.html)) {
      fail('official company publisher no longer exposes the verified recruitment handoff')
    }
    const handoff = await fetchPage(RECRUITMENT_HANDOFF_URL, { signal })
    assertNotAborted(signal)
    if (handoff?.status !== 200 || !sameUrl(handoff.finalUrl, PORTAL_ORIGIN + '/job/detail/BTWI_S-E-P_1366947')
      || !/<title>\s*Candidate Portal\s*<\/title>/i.test(handoff.html) || !/<app-root\b/i.test(handoff.html)
      || !/main-[A-Z0-9]+\.js/.test(handoff.html)) fail('published recruitment handoff no longer reaches the verified public tenant')
    const headers = { Accept: 'application/json,text/plain,*/*', 'Content-Type': 'application/json', Origin: PORTAL_ORIGIN, Referer: JOB_LISTINGS_URL }
    const urlinfo = await fetchJson(PUBLIC_API_BASE + 'urlinfo', { headers, signal })
    const layout = await fetchJson(PUBLIC_API_BASE + 'layout?isPreview=false', { headers, signal })
    assertNotAborted(signal)
    assertPublicTenant(urlinfo, layout)
    const listings = []
    const seen = new Set()
    let total = null
    let pagesFetched = 0
    for (let offset = 0; total == null || offset < total; offset += pageSize) {
      assertNotAborted(signal)
      if (pagesFetched >= maxPages) fail('inventory is incomplete because the page cap truncated the public listing')
      const payload = await fetchJson(buildJobsApiUrl(offset, pageSize), { method: 'POST', headers, body: '{}', signal })
      assertNotAborted(signal)
      if (!Number.isSafeInteger(payload?.totalRecords) || payload.totalRecords < 0 || !Array.isArray(payload.response)) fail('listing inventory shape or reported total is malformed')
      if (total != null && total !== payload.totalRecords) fail('listing inventory total changed during pagination')
      total = payload.totalRecords
      if (payload.response.length !== Math.min(pageSize, Math.max(total - offset, 0))) fail('listing inventory page count does not reconcile with its reported total')
      pagesFetched += 1
      for (const listing of payload.response) {
        assertListing(listing)
        if (seen.has(listing.jobCode)) fail('listing inventory repeats a requisition across the complete feed')
        seen.add(listing.jobCode)
        listings.push(listing)
      }
    }
    if (listings.length !== total) fail('listing inventory count is incomplete')
    const controller = new AbortController()
    const detailSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    const details = new Array(listings.length)
    let cursor = 0
    let failure = null
    await Promise.all(Array.from({ length: Math.min(detailConcurrency, listings.length) }, async () => {
      while (cursor < listings.length && !failure) {
        const index = cursor++
        try {
          assertNotAborted(detailSignal)
          const payload = await fetchJson(buildJobDetailsApiUrl(listings[index].jobCode), { headers, signal: detailSignal })
          assertNotAborted(detailSignal)
          details[index] = assertDetail(listings[index], payload)
        } catch (error) {
          failure ??= error
          controller.abort(error)
        }
      }
    }))
    if (failure) throw failure
    assertNotAborted(signal)
    const scrapedAt = new Date().toISOString()
    const jobs = listings.map((listing, index) => mapJob(listing, details[index], scrapedAt)).filter((job) => /^India$/i.test(job.country))
    return attachInventoryEvidence(jobs, {
      status: total === 0 ? 'verified-empty' : 'complete-inventory',
      surface: buildJobsApiUrl(), firstParty: true, listingComplete: true,
      pagesFetched, reportedTotal: total, indiaFacetCount: jobs.length, verifiedAt: scrapedAt,
      reason: 'Employer-published handoff; exact BMW tenant, complete public global listing and all requisition details reconciled; India uses explicit listing/detail country hierarchy.',
    })
  },
})

export const run = async (options = {}) => createBmwTechWorksIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
