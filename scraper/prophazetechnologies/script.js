import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'prophazetechnologies'
export const COMPANY = 'Prophaze Technologies'
export const HOMEPAGE_URL = 'https://www.prophaze.com/'
export const CAREERS_URL = 'https://www.prophaze.com/company/careers/'
export const JOBS_API_URL = 'https://www.prophaze.com/wp-json/wp/v2/awsm_job_openings?per_page=100&_fields=id,date,modified,status,link,title,slug'
export const JOB_DETAIL_API_BASE_URL = 'https://www.prophaze.com/wp-json/wp/v2/awsm_job_openings'

const COMPANY_DOMAIN = 'prophaze.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNALS = [
  'AI-Based WAAP Solution for Enterprises | Prophaze',
  'Enterprise WAAP. Managed Your Way.',
  'Meet Prophaze',
  'AI-powered and backed by 24×7 threat analysts',
]

const CAREERS_SIGNALS = [
  'Prophaze Careers | Join Our Team',
  'Grow, Learn, and Make an Impact with Us',
  'View Openings',
  'How We Hire',
]

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/\u200b/g, '')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeComparableUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  const parsed = new URL(absoluteUrl)
  parsed.hash = ''
  return parsed.toString().replace(/\/$/, '')
}

const isFirstPartyJobUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return false

  const url = new URL(absoluteUrl)
  return /^www\.prophaze\.com$/i.test(url.hostname)
    && /^\/jobs\/[^/]+\/?$/i.test(url.pathname)
}

const slugToWords = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/^job-location-/i, '')
    .replace(/^job-type-/i, '')
    .replace(/^experience-/i, '')
    .replace(/-/g, ' '),
)

const titleCase = (value) => normalizeWhitespace(value)
  .split(' ')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ')

const normalizeEmploymentType = (classList = []) => {
  const token = classList.find((item) => /^job-type-/i.test(item))
  const slug = slugToWords(token)
  if (!slug) return null
  if (/^full time$/i.test(slug)) return 'Full-time'
  if (/^part time$/i.test(slug)) return 'Part-time'
  if (/^contract$/i.test(slug)) return 'Contract'
  if (/^intern(ship)?$/i.test(slug)) return 'Internship'
  return titleCase(slug)
}

const normalizeLocations = (classList = []) => {
  const locations = classList
    .filter((item) => /^job-location-/i.test(item))
    .map((item) => titleCase(slugToWords(item)))
    .filter(Boolean)

  return [...new Set(locations)]
}

const normalizeExperienceFromClassList = (classList = []) => {
  const token = classList.find((item) => /^experience-/i.test(item))
  const slug = slugToWords(token)
  if (!slug) return null

  const normalized = slug
    .replace(/\byears\b/i, 'Years')
    .replace(/\byear\b/i, 'Year')
    .replace(/\bto\b/gi, '-')

  return titleCase(normalized)
    .replace(/\bAnd\b/g, 'and')
    .replace(/\b0 3\b/, '0-3')
}

const extractExperienceFromDescription = (contentHtml) => {
  const text = stripTags(contentHtml)
  const match = text.match(/(\d+\s*(?:\+|-\s*\d+)?)\s*years?\s+of\s+experience/i)
  if (!match) return null
  return normalizeWhitespace(`${match[1].replace(/\s*-\s*/g, '-')} Years`)
}

const extractMinimumQualification = (contentHtml) => {
  const text = stripTags(contentHtml)
  const match = text.match(/(Bachelor[^.:\n]*(?:field|degree|advantage)[^.:\n]*)/i)
  return match ? normalizeWhitespace(match[1]) : null
}

const buildJobDescription = (contentHtml) => {
  const text = stripTags(contentHtml)
  return text || null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return text.includes(HOMEPAGE_SIGNALS[0])
    && text.includes(HOMEPAGE_SIGNALS[2])
    && (text.includes(HOMEPAGE_SIGNALS[1]) || text.includes('AI-driven WAF, API protection'))
    && (text.includes(HOMEPAGE_SIGNALS[3]) || text.includes('AI & LLM Security'))
    && /href=["']https:\/\/www\.prophaze\.com\/company\/careers\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return CAREERS_SIGNALS.every((signal) => text.includes(signal))
    && extractFirstPartyJobUrls(page).length >= 1
}

export const extractFirstPartyJobUrls = (html) => {
  const urls = [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1], CAREERS_URL))
    .filter((url) => isFirstPartyJobUrl(url))

  return [...new Set(urls)]
}

export const extractPublishedJobSummaries = (payload) => {
  if (!Array.isArray(payload)) {
    throw new Error('Prophaze Technologies jobs index payload changed; refusing to scrape')
  }

  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Prophaze Technologies jobs index payload changed; refusing to scrape')
    }

    if (entry.status !== 'publish') return []

    const id = Number.parseInt(entry.id, 10)
    const link = toAbsoluteUrl(entry.link, HOMEPAGE_URL)
    const title = normalizeWhitespace(entry.title?.rendered)

    if (!Number.isInteger(id) || !link || !title || !isFirstPartyJobUrl(link)) {
      throw new Error('Prophaze Technologies jobs index payload changed; refusing to scrape')
    }

    return [{
      id,
      title,
      link,
      postingDate: normalizeWhitespace(entry.date),
      modifiedDate: normalizeWhitespace(entry.modified),
      slug: normalizeWhitespace(entry.slug),
    }]
  })
}

export const buildJobDetailApiUrl = (id) =>
  `${JOB_DETAIL_API_BASE_URL}/${id}?_fields=id,date,modified,status,link,title,content,class_list,slug`

export const extractJobFromDetailPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Prophaze Technologies job detail payload changed; refusing to scrape')
  }

  const id = Number.parseInt(payload.id, 10)
  const title = normalizeWhitespace(payload.title?.rendered)
  const link = toAbsoluteUrl(payload.link, HOMEPAGE_URL)
  const contentHtml = String(payload.content?.rendered ?? '')
  const classList = Array.isArray(payload.class_list) ? payload.class_list : []

  if (
    !Number.isInteger(id)
    || payload.status !== 'publish'
    || !title
    || !link
    || !isFirstPartyJobUrl(link)
    || !contentHtml
  ) {
    throw new Error('Prophaze Technologies job detail payload changed; refusing to scrape')
  }

  const locations = normalizeLocations(classList)
  const location = locations.length >= 1 ? `${locations.join(', ')}, India` : 'India'
  const city = locations[0] ?? null
  const employmentType = normalizeEmploymentType(classList)
  const experienceRequired =
    extractExperienceFromDescription(contentHtml)
    || normalizeExperienceFromClassList(classList)

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: 'India',
    jobId: String(id),
    requisitionId: String(id),
    sourceUrl: link,
    applyUrl: link,
    employmentType,
    experienceRequired,
    minimumQualification: extractMinimumQualification(contentHtml),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(payload.date) || null,
    closingDate: null,
    jobDescription: buildJobDescription(contentHtml),
    remoteStatus: 'On-site',
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createProphazeTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Prophaze Technologies official homepage signal changed; refusing to scrape')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Prophaze Technologies official careers surface changed; refusing to scrape')
    }

    const careersJobUrls = new Set(
      extractFirstPartyJobUrls(careersHtml)
        .map((url) => normalizeComparableUrl(url))
        .filter(Boolean),
    )

    const summaries = extractPublishedJobSummaries(await fetchJson(JOBS_API_URL))
    if (summaries.length === 0) {
      throw new Error('Prophaze Technologies jobs index no longer exposes published first-party roles')
    }

    for (const summary of summaries) {
      if (!careersJobUrls.has(normalizeComparableUrl(summary.link))) {
        throw new Error('Prophaze Technologies careers page and jobs index drifted; refusing to scrape')
      }
    }

    const jobs = []
    for (const summary of summaries) {
      const detailPayload = await fetchJson(buildJobDetailApiUrl(summary.id))
      const detailJob = extractJobFromDetailPayload(detailPayload)

      if (normalizeComparableUrl(detailJob.sourceUrl) !== normalizeComparableUrl(summary.link)) {
        throw new Error('Prophaze Technologies job detail link no longer matches the verified jobs index')
      }

      jobs.push(normalizeScrapedJob({
        ...detailJob,
        source: SOURCE,
        link: detailJob.applyUrl || detailJob.sourceUrl,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        scrapedAt: (overrideNow || now)(),
      }, {
        companyName: COMPANY,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        countryFilter: 'India',
      }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createProphazeTechnologiesScraper().run(options)

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
