import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'foraysoft'
export const COMPANY = 'ForaySoft'
export const OFFICIAL_BRAND = 'ForaySoft'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_URL = 'https://www.foraysoft.com/careers.html'
export const JOBS_URL = 'https://www.foraysoft.com/jobs/'
export const JOBS_PAGE_TWO_URL = 'https://www.foraysoft.com/jobs/?p=2'
export const DISPOSITION =
  'verified-first-party-careers-page-plus-stale-third-party-jobs-archive-fail-closed'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Saturday, July 25, 2026 that https://www.foraysoft.com/careers.html was the live first-party ForaySoft careers surface and that https://www.foraysoft.com/jobs/ plus https://www.foraysoft.com/jobs/?p=2 exposed a same-origin public jobs archive. The reviewed archive consisted of third-party placement roles such as Salesforce Support Engineer - Bezons, Tech Java Developer - Atos, Java Full Stack Developer - Xebia, SAP Consultant- KPMG, and D365, F&O Technical - Robert Bosch rather than trustworthy exact-company ForaySoft openings, and the visible Posted on markers were already stale on Saturday, July 25, 2026, with the newest reviewed archive dates still in September and October 2021. No trustworthy current exact-company public jobs contract was verified for ForaySoft, so this company-local scraper stays fail-closed and returns no jobs until a stable exact-company openings flow is verified.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const VERIFIED_ON_CUTOFF_ISO = '2026-07-25T00:00:00.000Z'
const DNS_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ERR_NAME_NOT_RESOLVED'])

const REQUIRED_CAREERS_PATTERNS = [
  /\bForay Into The\b/i,
  /\bFuture\./i,
  /Join ForaySoft\./i,
  /\bDo What\b/i,
  /you love\./i,
  /\bTop Jobs\b/i,
  /Java With fullstack/i,
  /Data And Analytics \(Big Data\)/i,
  /\bSalesforce\b/i,
  /\bHiring talent\b/i,
]

const REQUIRED_JOBS_PAGE_ONE_PATTERNS = [
  /\bJobs\b/i,
  /\bSalesforce Support Engineer - Bezons\b/i,
  /\bTech Java - Bezons\b/i,
  /\bTech Java Developer - Atos\b/i,
  /\bSenior QA Automation Tester - Atos\|Syntel\b/i,
  /\bPosted on 18th Oct 2021 11:26:55 in Salesforce\b/i,
  /\bPosted on 18th Oct 2021 11:16:09 in Java With fullstack\b/i,
  /\bPosted on 27th Sep 2021 16:37:52 in Java With fullstack\b/i,
]

const REQUIRED_JOBS_PAGE_TWO_PATTERNS = [
  /\bJava Full Stack Developer - Xebia\b/i,
  /\bBig Data Engineer - Xebia\b/i,
  /\bSenior Developer - Xebia\b/i,
  /\bJava \+ Microservices Backend Developer- Xebia\b/i,
  /\bSAP Consultant- KPMG\b/i,
  /\bD365, F&O Technical - Robert Bosch\b/i,
  /\bPosted on 21st Sep 2021 17:36:12 in Java With fullstack\b/i,
  /Posted on 21st Sep 2021 14:56:26 in Data And Analytics \(Big Data\)/i,
  /\bPosted on 16th Sep 2021 10:41:44 in Cloud\s*,\s*Python\b/i,
]

const THIRD_PARTY_CLIENT_PATTERNS = [
  /\bBezons\b/i,
  /\bAtos\b/i,
  /\bXebia\b/i,
  /\bMastek\b/i,
  /\bKPMG\b/i,
  /\bRobert Bosch\b/i,
]

const TRUSTED_JOBS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /workdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /freshteam\.com/i,
  /teamtailor\.com/i,
  /icims\.com$/i,
]

const LINKEDIN_PUBLIC_JOBS_PATTERNS = [
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/company\/[^/?#]+\/jobs(?:\/|[?#]|$)/i,
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/jobs\/search\/?(?:[?#].*)?$/i,
  /^https?:\/\/(?:[\w-]+\.)?linkedin\.com\/jobs\/view\/[^?#]+(?:[?#].*)?$/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeText = (value = '') =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isDnsResolutionError = (error) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    const code = typeof current.code === 'string' ? current.code : ''
    const message = String(current.message ?? '')

    if (
      DNS_ERROR_CODES.has(code)
      || /\b(?:ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|getaddrinfo ENOTFOUND)\b/i.test(message)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

const buildDiscoveryOnlyEvidence = (now) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: CAREERS_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'ForaySoft official careers hostname cannot be resolved; current exact-company inventory cannot be verified.',
  })

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )
  const urls = []

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(decodeEntities(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const parseHumanDateToIso = (value = '') => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const cleaned = normalized.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1')
  const parsed = new Date(`${cleaned} UTC`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export const extractArchivePostingDates = (html = '') =>
  [...normalizeText(html).matchAll(
    /\bPosted on (\d{1,2}(?:st|nd|rd|th) [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2})\b/gi,
  )].map((match) => match[1])

export const pageShowsThirdPartyPlacementArchive = (html = '') => {
  const text = normalizeText(html)
  return THIRD_PARTY_CLIENT_PATTERNS.some((pattern) => pattern.test(text))
}

export const assertVerifiedCareersSurface = (html = '') => {
  const text = normalizeText(html)

  if (REQUIRED_CAREERS_PATTERNS.every((pattern) => pattern.test(text))) return

  throw new Error(
    'ForaySoft verified careers surface changed; review the public contract before promotion.',
  )
}

export const assertVerifiedJobsArchiveSurface = (html = '', pageUrl = JOBS_URL) => {
  const text = normalizeText(html)
  const requiredPatterns =
    pageUrl === JOBS_PAGE_TWO_URL ? REQUIRED_JOBS_PAGE_TWO_PATTERNS : REQUIRED_JOBS_PAGE_ONE_PATTERNS

  if (requiredPatterns.every((pattern) => pattern.test(text))) return

  throw new Error(
    `ForaySoft verified jobs archive surface changed for ${pageUrl}; review the public contract before promotion.`,
  )
}

export const assertVerifiedThirdPartyPlacementArchive = (html = '', pageUrl = JOBS_URL) => {
  if (pageShowsThirdPartyPlacementArchive(html)) return

  throw new Error(
    `ForaySoft verified third-party placement archive changed for ${pageUrl}; review whether a trustworthy exact-company openings flow is now available.`,
  )
}

export const assertVerifiedStaleArchiveDates = (...pages) => {
  const postingDates = pages.flatMap((html) => extractArchivePostingDates(html))

  if (postingDates.length === 0) {
    throw new Error(
      'ForaySoft jobs archive no longer exposes the verified Posted on markers.',
    )
  }

  const parsedDates = postingDates.map((value) => parseHumanDateToIso(value))

  if (parsedDates.some((value) => !value)) {
    throw new Error(
      'ForaySoft jobs archive Posted on markers changed materially and could not be parsed.',
    )
  }

  if (parsedDates.every((value) => value < VERIFIED_ON_CUTOFF_ISO)) return

  throw new Error(
    'ForaySoft public jobs archive no longer matches the verified stale pre-Saturday-July-25-2026 contract; review whether trustworthy current exact-company jobs are now available.',
  )
}

export const assertNoUnexpectedExternalJobsSurface = (html = '', pageUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      `ForaySoft public surface now exposes JobPosting markup on ${pageUrl}; review whether a real parser should replace the fail-closed contract.`,
    )
  }

  const publicJobsUrl = extractLinkedUrls(html, pageUrl).find((url) => {
    if (TRUSTED_JOBS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return true
    return LINKEDIN_PUBLIC_JOBS_PATTERNS.some((pattern) => pattern.test(url.toString()))
  })

  if (!publicJobsUrl) return

  throw new Error(
    `ForaySoft public surface changed materially via ${publicJobsUrl.toString()}.`,
  )
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: `${SOURCE}-html`,
    timeoutMs: 15000,
  })

export const createForaySoftScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    try {
      const careersHtml = await fetchText(CAREERS_URL)
      assertVerifiedCareersSurface(careersHtml)
      assertNoUnexpectedExternalJobsSurface(careersHtml, CAREERS_URL)

      const jobsHtml = await fetchText(JOBS_URL)
      assertVerifiedJobsArchiveSurface(jobsHtml, JOBS_URL)
      assertVerifiedThirdPartyPlacementArchive(jobsHtml, JOBS_URL)
      assertNoUnexpectedExternalJobsSurface(jobsHtml, JOBS_URL)

      const jobsPageTwoHtml = await fetchText(JOBS_PAGE_TWO_URL)
      assertVerifiedJobsArchiveSurface(jobsPageTwoHtml, JOBS_PAGE_TWO_URL)
      assertVerifiedThirdPartyPlacementArchive(jobsPageTwoHtml, JOBS_PAGE_TWO_URL)
      assertNoUnexpectedExternalJobsSurface(jobsPageTwoHtml, JOBS_PAGE_TWO_URL)

      assertVerifiedStaleArchiveDates(jobsHtml, jobsPageTwoHtml)

      return createFailClosedSentinelScraper().run()
    } catch (error) {
      if (isDnsResolutionError(error)) return buildDiscoveryOnlyEvidence(now)
      throw error
    }
  },
})

export const run = async (options = {}) => createForaySoftScraper(options).run(options)

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
