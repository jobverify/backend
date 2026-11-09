import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG, {
  VERIFIED_SURFACE_SUMMARY,
} from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ELECTRONICS_CORPORATION_OF_INDIA_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CURRENT_JOB_OPENINGS_URL = PROVIDER_METADATA.companyCareerPage
export const PAGE_TWO_URL = PROVIDER_METADATA.currentOpeningsPage2Url
export { VERIFIED_SURFACE_SUMMARY }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&#039;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const absoluteUrl = (value, baseUrl = CURRENT_JOB_OPENINGS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractHref = (html) => String(html ?? '').match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || null

const extractRows = (html) => {
  const tableMatch = String(html ?? '').match(
    /<table\b[^>]*class=["'][^"']*\btable\b[^"']*["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i,
  )
  if (!tableMatch) return []

  return [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]),
    )
    .filter((cells) => cells.length >= 5)
}

const extractDocumentLinks = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => ({
    label: stripTags(match[3]),
    url: absoluteUrl(match[2]),
  }))
  .filter((item) => item.label && item.url)

const selectSourceUrl = (documents) => (
  documents.find((item) => /\badvert/i.test(item.label))
  || documents[0]
  || null
)

const selectApplyUrl = (documents, fallbackUrl) => (
  documents.find((item) => /^application form$/i.test(item.label))?.url
  || fallbackUrl
)

const buildJobDescription = (advtNo) =>
  `Official ECIL current job opening (${advtNo}). See the linked first-party documents for eligibility, schedule, and application details.`

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*(?:Electronics Corporation of India Limited|Home page) \| ECIL \| DAE \| India\s*<\/title>/i.test(page)
    && /Electronics Corporation of India Limited/i.test(page)
    && extractCurrentJobOpeningsUrl(page) === CURRENT_JOB_OPENINGS_URL
}

export const extractCurrentJobOpeningsUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href\s*=\s*(["'])(\/jobopenings)\1[^>]*>\s*Current Job Openings\s*<\/a>/i,
  )
  return match ? absoluteUrl(match[2], HOMEPAGE_URL) : null
}

export const hasVerifiedCurrentJobOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Current Job Openings \| ECIL \| DAE \| India\s*<\/title>/i.test(page)
    && /class=["'][^"']*\bgrid-view\b/i.test(page)
    && /Showing \d+-\d+ of \d+ items\./i.test(text)
    && /<th>\s*S\.No\s*<\/th>/i.test(page)
    && /<th>\s*Advt No\s*<\/th>/i.test(page)
    && /<th>\s*Short Description\s*<\/th>/i.test(page)
    && /<th>\s*Documents\s*<\/th>/i.test(page)
    && /<th>\s*Links\s*<\/th>/i.test(page)
}

export const extractPaginationSummary = (html = '') => {
  const match = String(html ?? '').match(
    /<div class=["']summary["']>\s*Showing\s*<b>(\d+)-(\d+)<\/b>\s*of\s*<b>(\d+)<\/b>\s*items\.\s*<\/div>/i,
  )
  if (!match) return null

  return {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  }
}

export const extractNextPageUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<li class=["']next(?:\s+disabled)?["']>([\s\S]*?)<\/li>/i,
  )
  const nextHtml = match?.[1] || ''
  if (/disabled/i.test(match?.[0] || '')) {
    return null
  }

  const href = extractHref(nextHtml)
  return href ? absoluteUrl(href, CURRENT_JOB_OPENINGS_URL) : null
}

export const extractOpeningsFromPage = (html = '') => {
  if (!hasVerifiedCurrentJobOpeningsSignal(html)) {
    throw new Error('Electronics Corporation of India Limited current job openings page no longer matches the verified official surface')
  }

  const rows = extractRows(html)
  if (rows.length === 0) {
    throw new Error('Electronics Corporation of India Limited current job openings page no longer exposes the expected listings rows')
  }

  return rows.map((cells) => {
    const advtNo = stripTags(cells[1])
    const title = stripTags(cells[2])
    const documents = extractDocumentLinks(cells[3])
    const sourceDocument = selectSourceUrl(documents)

    if (!advtNo || !title || !sourceDocument?.url) {
      return null
    }

    const requisitionId = slugify(advtNo)
    const sourceUrl = sourceDocument.url
    const applyUrl = selectApplyUrl(documents, sourceUrl)

    return {
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: `ecil-${requisitionId}`,
      requisitionId,
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(advtNo),
    }
  }).filter(Boolean)
}

export const createElectronicsCorporationOfIndiaLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    let homepageHtml = await fetchText(HOMEPAGE_URL)
    const landingTitle = String(homepageHtml).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''
    if (/^\s*Electronics Corporation of India Limited \| DAE \| India\s*$/i.test(landingTitle)
      && /id=["']language-switcher-form["']/i.test(homepageHtml)
      && /alt=["']ECIL Logo["']/i.test(homepageHtml)
      && /<a\b[^>]*href=["']\/home["'][^>]*>/i.test(homepageHtml)) {
      homepageHtml = await fetchText(new URL('/home', HOMEPAGE_URL).href)
    }
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Electronics Corporation of India Limited homepage no longer matches the verified official surface')
    }

    const pageOneHtml = await fetchText(CURRENT_JOB_OPENINGS_URL)
    if (!hasVerifiedCurrentJobOpeningsSignal(pageOneHtml)) {
      throw new Error('Electronics Corporation of India Limited current job openings page no longer matches the verified official surface')
    }

    const pageOneSummary = extractPaginationSummary(pageOneHtml)
    if (
      !pageOneSummary
      || pageOneSummary.start !== 1
      || pageOneSummary.end !== 10
      || pageOneSummary.total <= 10
    ) {
      throw new Error('Electronics Corporation of India Limited page 1 pagination contract changed')
    }

    if (extractNextPageUrl(pageOneHtml) !== PAGE_TWO_URL) {
      throw new Error('Electronics Corporation of India Limited page 1 next-page contract changed')
    }

    const pageTwoHtml = await fetchText(PAGE_TWO_URL)
    if (!hasVerifiedCurrentJobOpeningsSignal(pageTwoHtml)) {
      throw new Error('Electronics Corporation of India Limited current job openings page 2 no longer matches the verified official surface')
    }

    const pageTwoSummary = extractPaginationSummary(pageTwoHtml)
    if (
      !pageTwoSummary
      || pageTwoSummary.start !== 11
      || pageTwoSummary.end < pageTwoSummary.start
      || pageTwoSummary.total !== pageTwoSummary.end
    ) {
      throw new Error('Electronics Corporation of India Limited page 2 pagination contract changed')
    }

    if (extractNextPageUrl(pageTwoHtml) !== null) {
      throw new Error('Electronics Corporation of India Limited page 2 next-page contract changed')
    }

    const jobs = [
      ...extractOpeningsFromPage(pageOneHtml),
      ...extractOpeningsFromPage(pageTwoHtml),
    ]

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) =>
  createElectronicsCorporationOfIndiaLimitedScraper().run(options)

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
