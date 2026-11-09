import path from 'node:path'
import { fileURLToPath } from 'node:url'

import APAR_TECHNOLOGIES_CATALOG from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = APAR_TECHNOLOGIES_CATALOG.source
export const COMPANY = APAR_TECHNOLOGIES_CATALOG.companyName
export const VERIFIED_AT = APAR_TECHNOLOGIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = APAR_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = APAR_TECHNOLOGIES_CATALOG.officialHomepageUrl
export const CAREERS_URL = APAR_TECHNOLOGIES_CATALOG.companyCareerPage
export const US_OPENINGS_URL = APAR_TECHNOLOGIES_CATALOG.usOpeningsPageUrl
export const APAC_OPENINGS_URL = APAR_TECHNOLOGIES_CATALOG.apacOpeningsPageUrl
export const ROBOTS_TXT_URL = APAR_TECHNOLOGIES_CATALOG.robotsTxtUrl
export const SITEMAP_INDEX_URL = APAR_TECHNOLOGIES_CATALOG.sitemapIndexUrl
export const PAGE_SITEMAP_URL = APAR_TECHNOLOGIES_CATALOG.pageSitemapUrl
export const CONTACT_EMAIL = APAR_TECHNOLOGIES_CATALOG.officialContactEmail
export const EXPECTED_CAREER_URLS_FROM_PAGE_SITEMAP = [
  CAREERS_URL,
  US_OPENINGS_URL,
  APAC_OPENINGS_URL,
]
export const MISSING_JOB_ROUTE_URLS = [
  'https://www.apartechnologies.com/jobs',
  'https://www.apartechnologies.com/join-us',
  'https://www.apartechnologies.com/work-with-us',
  'https://www.apartechnologies.com/openings',
  'https://www.apartechnologies.com/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /peoplestrong/i,
  /icims/i,
  /taleo/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
)

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    url.hostname = url.hostname.replace(/^www\./i, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: options.signal ? AbortSignal.any([options.signal, createTimeoutSignal(15000)]) : createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || fallbackUrl

const extractAnchorHrefByLabel = (html = '', labelPattern, baseUrl) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1]
    const label = normalizeWhitespace(match[2])

    if (!labelPattern.test(label)) {
      continue
    }

    return toAbsoluteUrl(href, baseUrl)
  }

  return null
}

export const hasPublicJobListingSignal = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return normalized.includes('apar technologies - accelerate agility')
    && normalized.includes('accelerate agility')
    && />\s*Careers\s*</i.test(page)
    && />\s*Join Us\s*</i.test(page)
}

export const hasCurrentHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Enterprise Technology Services Partner \| Apar Technologies\s*<\/title>/i.test(page)
    && sameUrl(extractHomepageCareerUrl(page), CAREERS_URL)
}

export const hasCurrentCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers at Apar Technologies \| IT &amp; Tech Jobs\s*<\/title>/i.test(page)
    && /\bJoin our team\b/i.test(normalizeWhitespace(page))
    && /<form\b/i.test(page)
    && /<input\b[^>]*type="file"/i.test(page)
    && !hasPublicJobListingSignal(page)
    && !/https?:\/\/(?:jobs\.lever\.co|job-boards\.greenhouse\.io|boards\.greenhouse\.io|api\.ashbyhq\.com)/i.test(page)
}

export const extractHomepageCareerUrl = (html = '') =>
  extractAnchorHrefByLabel(html, /^Careers$/i, HOMEPAGE_URL)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return normalized.includes('careers - apar technologies')
    && normalized.includes('careers with apar')
    && normalized.includes('come, innovate with us')
    && normalized.includes('join our community')
    && normalized.includes('join our team')
    && normalized.includes('upload your resume*')
    && normalized.includes(CONTACT_EMAIL.toLowerCase())
}

export const extractRegionalOpeningsUrls = (html = '') => ({
  usOpeningsUrl: extractAnchorHrefByLabel(html, /^US Openings$/i, CAREERS_URL),
  apacOpeningsUrl: extractAnchorHrefByLabel(html, /^APAC Openings$/i, CAREERS_URL),
})

const hasRegionalPlaceholderSignal = ({
  page,
  expectedUrl,
  titlePattern,
  headingText,
  subheadingText,
}) => {
  const html = String(page?.html ?? '')
  const comparableHtml = decodeHtmlEntities(html)
  const normalized = normalizeText(html)

  return Number(page?.status) === 200
    && sameUrl(page?.url, expectedUrl)
    && (titlePattern.test(html) || titlePattern.test(comparableHtml))
    && normalized.includes(headingText.toLowerCase())
    && normalized.includes(subheadingText.toLowerCase())
    && normalized.includes(CONTACT_EMAIL.toLowerCase())
    && !hasPublicJobListingSignal(html)
  }

export const hasUsOpeningsPlaceholderSignal = (page = {}) =>
  hasRegionalPlaceholderSignal({
    page,
    expectedUrl: US_OPENINGS_URL,
    titlePattern: /<title>\s*Job Posting\s*[-–]\s*Apar Technologies\s*<\/title>/i,
    headingText: 'Job Posting',
    subheadingText: 'Job Listing',
  })

export const hasApacOpeningsPlaceholderSignal = (page = {}) =>
  hasRegionalPlaceholderSignal({
    page,
    expectedUrl: APAC_OPENINGS_URL,
    titlePattern: /<title>\s*APAC\s*[-–]\s*Apar Technologies\s*<\/title>/i,
    headingText: 'APAC',
    subheadingText: 'APAC Job Listing',
  })

export const hasExpectedRobotsSignal = (text = '') =>
  /User-agent:\s*\*/i.test(String(text ?? ''))
    && !/\bcareers?\b|\bjobs?\b|job-posting|join-us|work-with-us|openings|greenhouse|lever|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|successfactors|oraclecloud|darwinbox|icims|taleo|peoplestrong/i.test(String(text ?? ''))

export const hasExpectedSitemapIndexSignal = (xml = '') => {
  const urls = [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1])

  return urls.includes(PAGE_SITEMAP_URL)
    && urls.includes('https://www.apartechnologies.com/wp-sitemap-posts-post-1.xml')
  }

export const extractExpectedCareerUrlsFromPageSitemap = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>(https:\/\/www\.apartechnologies\.com\/(?:careers|job-posting|apac-2)\/)<\/loc>/gi)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)

export const isKnownMissingJobRoute = (page = {}, requestedUrl) => {
  const finalUrl = getFinalUrl(page, requestedUrl)

  return Number(page?.status) === 404
    && sameUrl(finalUrl, requestedUrl)
    && normalizeText(page?.html).includes('page not found - apar technologies')
    && !hasPublicJobListingSignal(page?.html)
  }

export const createAparTechnologiesScraper = () => ({
  async run({ fetchPage: providedFetch = defaultFetchPage, signal, onAudit, now = () => new Date().toISOString() } = {}) {
    const fetchPage = async url => {
      signal?.throwIfAborted()
      const response = await providedFetch(url, { signal })
      signal?.throwIfAborted()
      return response
    }
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status === 200 && sameUrl(homepage.url, HOMEPAGE_URL)
      && hasCurrentHomepageSignal(homepage.html)) {
      const careers = await fetchPage(CAREERS_URL)
      if (careers.status !== 200 || !sameUrl(careers.url, CAREERS_URL)
        || !hasCurrentCareersSignal(careers.html)) {
        throw new Error('Apar Technologies current careers form no longer matches the known first-party surface')
      }
      const jobs = [], observations = [{ kind: 'general-cv-intake', url: CAREERS_URL, vacancy: false, descriptionComplete: false, country: null }]
      const evidence = { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false,
        pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
        reason: 'current-resume-upload-form-without-a-native-vacancy-inventory-or-zero-count' }
      attachInventoryEvidence(jobs, evidence)
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'hiring-signals', observedRecordCount: 1,
        observedVacancyCount: 0, sourceScopeComplete: false })
      await onAudit?.({ source: SOURCE, observations, inventoryEvidence: evidence, productionWrites: false })
      signal?.throwIfAborted()
      return jobs
    }

    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Apar Technologies verified official homepage changed materially')
    }

    if (!sameUrl(extractHomepageCareerUrl(homepage.html), CAREERS_URL)) {
      throw new Error('Apar Technologies verified homepage careers handoff changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Apar Technologies verified careers page changed materially')
    }

    const regionalOpeningsUrls = extractRegionalOpeningsUrls(careersPage.html)
    if (
      !sameUrl(regionalOpeningsUrls.usOpeningsUrl, US_OPENINGS_URL)
      || !sameUrl(regionalOpeningsUrls.apacOpeningsUrl, APAC_OPENINGS_URL)
    ) {
      throw new Error('Apar Technologies verified careers page regional handoff changed materially')
    }

    const usOpeningsPage = await fetchPage(US_OPENINGS_URL)
    if (hasPublicJobListingSignal(usOpeningsPage.html)) {
      throw new Error('Apar Technologies US openings page now appears to expose a public jobs board')
    }
    if (!hasUsOpeningsPlaceholderSignal(usOpeningsPage)) {
      throw new Error('Apar Technologies US openings placeholder surface changed materially')
    }

    const apacOpeningsPage = await fetchPage(APAC_OPENINGS_URL)
    if (hasPublicJobListingSignal(apacOpeningsPage.html)) {
      throw new Error('Apar Technologies APAC openings page now appears to expose a public jobs board')
    }
    if (!hasApacOpeningsPlaceholderSignal(apacOpeningsPage)) {
      throw new Error('Apar Technologies APAC openings placeholder surface changed materially')
    }

    const robotsTxtPage = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxtPage.status !== 200 || !hasExpectedRobotsSignal(robotsTxtPage.html)) {
      throw new Error('Apar Technologies verified robots.txt surface changed materially')
    }

    const sitemapIndexPage = await fetchPage(SITEMAP_INDEX_URL)
    if (sitemapIndexPage.status !== 200 || !hasExpectedSitemapIndexSignal(sitemapIndexPage.html)) {
      throw new Error('Apar Technologies verified sitemap index changed materially')
    }

    const pageSitemapPage = await fetchPage(PAGE_SITEMAP_URL)
    const careerUrlsFromPageSitemap = extractExpectedCareerUrlsFromPageSitemap(pageSitemapPage.html)
    if (
      pageSitemapPage.status !== 200
      || careerUrlsFromPageSitemap.length !== EXPECTED_CAREER_URLS_FROM_PAGE_SITEMAP.length
      || !EXPECTED_CAREER_URLS_FROM_PAGE_SITEMAP.every((url, index) =>
        sameUrl(url, careerUrlsFromPageSitemap[index]),
      )
    ) {
      throw new Error('Apar Technologies verified page sitemap careers urls changed materially')
    }

    for (const routeUrl of MISSING_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isKnownMissingJobRoute(routePage, routeUrl)) {
        throw new Error(`Apar Technologies verified no-public-careers route changed: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAparTechnologiesScraper().run(options)

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
