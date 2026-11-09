import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'

import {
  ATREE_CATALOG,
  VERIFIED_APPLY_URLS,
  VERIFIED_JOB_DETAIL_URLS,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ATREE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const GET_INVOLVED_URL = PROVIDER_METADATA.getInvolvedUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LEGACY_CAREER_URL = PROVIDER_METADATA.legacyCareerPageUrl
export const WORK_WITH_US_URL = PROVIDER_METADATA.workWithUsUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const CAREER_POST_SITEMAP_URL = PROVIDER_METADATA.careerPostSitemapUrl
export const CHECKED_MISSING_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]
export const ERP_JOBS_URL = 'https://erp.atree.org/jobs'
export const VERIFIED_JOB_DETAIL_URLS_CONST = [...VERIFIED_JOB_DETAIL_URLS]
export const VERIFIED_APPLY_URLS_CONST = [...VERIFIED_APPLY_URLS]
export { VERIFIED_JOB_DETAIL_URLS_CONST as VERIFIED_JOB_DETAIL_URLS }
export { VERIFIED_APPLY_URLS_CONST as VERIFIED_APPLY_URLS }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DETAIL_SECTION_HEADINGS = [
  'Description',
  'Responsibilities',
  'Qualifications',
  'How to Apply',
  'Contact',
  'Note',
  'Date Posted',
  'Valid Through',
  'Employment Type',
  'Job Location',
]

const FIELD_SEQUENCE = [
  'Date Posted',
  'Valid Through',
  'Employment Type',
  'Job Location',
]

const MONTH_LOOKUP = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<\/?(?:p|div|section|article|li|ul|ol|h[1-6]|br)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const textLines = (value = '') => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<img[^>]*>/gi, ' ')
  .replace(/<\/?(?:h[1-6]|p|div|section|article|li|ul|ol|br)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => stripTags(line))
  .filter(Boolean)

const decodeUrlEntities = (value) => String(value ?? '')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .trim()

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const sameUrl = (left, right) => normalizeUrl(left) === normalizeUrl(right)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const normalizeTitle = (value) => normalizeWhitespace(decodeNativeEntities(value))

const extractAllAnchors = (html = '', baseUrl) =>
  [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const href = decodeUrlEntities(match[1])

      return {
        href,
        absoluteUrl: toAbsoluteUrl(href, baseUrl),
        label: stripTags(match[2]),
      }
    })

const isAcceptedApplyUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    const nativeApplication = url.origin === 'https://erp.atree.org'
      && !url.username && !url.password && !url.hash
      && url.pathname === '/job_application/new'
      && /^\?job_title=HR-OPN-\d{4}-\d{4}$/.test(url.search)
    return nativeApplication || url.hostname === 'forms.gle'
      || url.hostname === 'docs.google.com'
      || url.hostname === 'mail.google.com'
  } catch {
    return false
  }
}

const extractSectionText = (html = '', heading) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h3[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h3>[\\s\\S]*?<div[^>]*class=["'][^"']*elementor-widget-container[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )

  const directMatch = stripTags(match?.[1])
  if (directMatch) return directMatch

  const lines = textLines(html)
  const startIndex = lines.findIndex((line) => line === heading)
  if (startIndex === -1) return null

  const parts = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (DETAIL_SECTION_HEADINGS.includes(line) || line === 'Position Title') break
    if (line === 'Apply Now') break
    parts.push(line)
  }

  return normalizeWhitespace(parts.join(' ')) || null
}

const extractJobIdFromUrl = (value) => {
  try {
    const pathname = new URL(String(value ?? '')).pathname
    const segments = pathname.split('/').filter(Boolean)
    return segments.at(-1) ?? null
  } catch {
    return null
  }
}

const parseHumanDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  let match = normalized.match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/)
  if (match) {
    const [, day, monthName, year] = match
    const month = MONTH_LOOKUP[monthName.toLowerCase()]
    if (!month) return null
    return `${year}-${month}-${day.padStart(2, '0')}`
  }

  match = normalized.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/)
  if (match) {
    const [, monthName, day, year] = match
    const month = MONTH_LOOKUP[monthName.toLowerCase()]
    if (!month) return null
    return `${year}-${month}-${day.padStart(2, '0')}`
  }

  return null
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractCareersUrl = (html = '') => {
  const anchors = extractAllAnchors(html, HOMEPAGE_URL)

  const matchedAnchor = anchors.find((anchor) =>
    anchor.absoluteUrl
    && (sameUrl(anchor.absoluteUrl, CAREERS_URL) || sameUrl(anchor.absoluteUrl, ERP_JOBS_URL)))
  return matchedAnchor?.absoluteUrl ?? null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml)

  return normalized.includes('Ashoka Trust for Research in Ecology and the Environment (ATREE)')
    && normalized.includes('ATREE')
    && /href=["']https:\/\/www\.atree\.org\/get-involved\/["']/i.test(rawHtml)
}

export const hasErpJobsPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Job Openings\s*<\/title>/i.test(rawHtml)
    && /Built on Frappe/i.test(rawHtml)
    && /class=["']jobs-page["']/i.test(rawHtml)
    && /id=["']search-box["']/i.test(rawHtml)
}

export const erpJobsPageHasPublicListings = (html = '') =>
  /<a\b[^>]+href=["'][^"']*\/jobs\/[^"']+["']/i.test(String(html ?? ''))

export const extractListingCards = (html = '') =>
  [...String(html ?? '').matchAll(
    /<h6[^>]*>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/h6>[\s\S]*?Deadline:\s*([^<]+)[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span[^>]*>\s*VIEW\s*<\/span>/gi,
  )]
    .map((match) => {
      const headingUrl = toAbsoluteUrl(match[1], CAREERS_URL)
      const viewUrl = toAbsoluteUrl(match[4], CAREERS_URL)

      if (!headingUrl || !viewUrl || !sameUrl(headingUrl, viewUrl)) return null

      return {
        title: normalizeTitle(stripTags(match[2])),
        deadline: normalizeWhitespace(match[3]),
        detailUrl: viewUrl,
      }
    })
    .filter(Boolean)

export const hasCareersPageSignal = (html = '') => {
  const title = extractTitle(html)
  const cards = extractListingCards(html)

  return title === 'Careers'
    && cards.length > 0
    && /Deadline:/i.test(String(html ?? ''))
}

export const hasSitemapIndexSignal = (xml = '') =>
  String(xml ?? '').includes(CAREER_POST_SITEMAP_URL)

export const extractCareerUrlsFromSitemap = (xml = '') =>
  VERIFIED_JOB_DETAIL_URLS.filter((url) => String(xml ?? '').includes(url))

const extractLocUrls = (xml = '') =>
  [...String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => normalizeUrl(match[1]))
    .filter(Boolean)

export const isLegacyCareerRedirect = (page = {}) =>
  sameUrl(page.requestedUrl, LEGACY_CAREER_URL)
  && Number(page.status) === 200
  && sameUrl(page.url, CAREERS_URL)
  && hasCareersPageSignal(page.html)

export const isMissingCareersRoute = (page = {}) => {
  const title = extractTitle(page.html)
  let isOfficialDomain = false

  try {
    const hostname = new URL(String(page.url ?? '')).hostname.toLowerCase()
    isOfficialDomain = hostname === 'www.atree.org' || hostname === 'atree.org'
  } catch {
    isOfficialDomain = false
  }

  return Number(page.status) === 404
    && isOfficialDomain
    && title === 'Page not found'
}

export const extractApplyUrl = (html = '') => {
  const anchors = extractAllAnchors(html, CAREERS_URL)
  const matchedAnchor = anchors.find((anchor) =>
    anchor.label === 'Apply Now'
    && isAcceptedApplyUrl(anchor.absoluteUrl || anchor.href),
  )

  return matchedAnchor?.absoluteUrl || matchedAnchor?.href || null
}

export const extractLabeledFieldValue = (html = '', label) =>
  extractSectionText(html, label)

export const extractDetailDescription = (html = '') => {
  const parts = []

  for (const heading of ['Description', 'Responsibilities', 'Qualifications', 'How to Apply']) {
    const text = extractSectionText(html, heading)
    if (text) {
      parts.push(`${heading}: ${text}`)
    }
  }

  return parts.length > 0 ? parts.join(' ') : null
}

const hasVerifiedDetailSurface = (html = '', card = {}) => {
  const title = normalizeTitle(extractTitle(html))
  const applyUrl = extractApplyUrl(html)
  const datePosted = extractLabeledFieldValue(html, 'Date Posted')
  const validThrough = extractLabeledFieldValue(html, 'Valid Through')
  const employmentType = extractLabeledFieldValue(html, 'Employment Type')
  const location = extractLabeledFieldValue(html, 'Job Location')
  const description = extractDetailDescription(html)

  return title === normalizeTitle(card.title)
    && applyUrl !== null
    && isAcceptedApplyUrl(applyUrl)
    && datePosted !== null
    && validThrough === card.deadline
    && employmentType !== null
    && location !== null
    && description !== null
}

const mapJob = (card, detailHtml, now) => {
  const location = extractLabeledFieldValue(detailHtml, 'Job Location')

  return {
    title: card.title,
    company: COMPANY,
    department: null,
    location: `${location}, India`,
    city: location,
    country: 'India',
    jobId: extractJobIdFromUrl(card.detailUrl),
    requisitionId: null,
    sourceUrl: card.detailUrl,
    applyUrl: extractApplyUrl(detailHtml),
    employmentType: extractLabeledFieldValue(detailHtml, 'Employment Type'),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: parseHumanDate(extractLabeledFieldValue(detailHtml, 'Date Posted')),
    closingDate: parseHumanDate(extractLabeledFieldValue(detailHtml, 'Valid Through')),
    jobDescription: extractDetailDescription(detailHtml),
    source: SOURCE,
    link: extractApplyUrl(detailHtml),
    scrapedAt: now(),
  }
}

export const createAtreeScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Atree verified homepage no longer matches the trusted first-party surface')
    }

    if (extractCareersUrl(homepage.html) !== CAREERS_URL) {
      if (extractCareersUrl(homepage.html) !== ERP_JOBS_URL) {
        throw new Error('Atree verified homepage careers link changed materially')
      }

      const erpJobsPage = await fetchPage(ERP_JOBS_URL)
      if (
        erpJobsPage.status !== 200
        || !sameUrl(erpJobsPage.url, ERP_JOBS_URL)
        || !hasErpJobsPageSignal(erpJobsPage.html)
      ) {
        throw new Error('Atree verified ERP jobs portal no longer matches the trusted first-party surface')
      }

      if (erpJobsPageHasPublicListings(erpJobsPage.html)) {
        throw new Error('Atree ERP jobs portal now exposes public listings that require a dedicated parser')
      }

      return []
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Atree verified careers page no longer matches the trusted first-party surface')
    }

    const listingCards = extractListingCards(careersPage.html)
    if (listingCards.length === 0) {
      throw new Error('Atree verified careers page no longer matches the trusted first-party surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (
      sitemapPage.status !== 200
      || !sameUrl(sitemapPage.url, SITEMAP_URL)
      || !hasSitemapIndexSignal(sitemapPage.html)
    ) {
      throw new Error('Atree verified sitemap no longer advertises the trusted careers surface')
    }

    const careerSitemapPage = await fetchPage(CAREER_POST_SITEMAP_URL)
    const careerSitemapUrls = new Set(extractLocUrls(careerSitemapPage.html))
    const allListingUrlsAppearInSitemap = listingCards.every((card) =>
      careerSitemapUrls.has(normalizeUrl(card.detailUrl)))

    if (
      careerSitemapPage.status !== 200
      || !sameUrl(careerSitemapPage.url, CAREER_POST_SITEMAP_URL)
      || !allListingUrlsAppearInSitemap
    ) {
      throw new Error('Atree verified career sitemap no longer matches the trusted first-party surface')
    }

    const legacyCareerPage = await fetchPage(LEGACY_CAREER_URL)
    if (!isLegacyCareerRedirect({
      requestedUrl: LEGACY_CAREER_URL,
      status: legacyCareerPage.status,
      url: legacyCareerPage.url,
      html: legacyCareerPage.html,
    })) {
      throw new Error('Atree verified legacy career route changed materially')
    }

    for (const routeUrl of CHECKED_MISSING_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isMissingCareersRoute(routePage)) {
        throw new Error(`Atree verified missing careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    const jobs = []

    for (const card of listingCards) {
      const detailPage = await fetchPage(card.detailUrl)

      if (
        detailPage.status !== 200
        || !sameUrl(detailPage.url, card.detailUrl)
        || !hasVerifiedDetailSurface(detailPage.html, card)
      ) {
        throw new Error(`Atree detail page surface changed: ${card.detailUrl}`)
      }

      jobs.push(mapJob(card, detailPage.html, now))
    }

    return jobs
  },
})

export const run = async (options = {}) => createAtreeScraper(options).run(options)

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
