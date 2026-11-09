import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'prdcprivatelimited'
export const COMPANY = 'Power Research and Development Consultants Private Limited'
export const CAREERS_URL = 'https://beta.prdcinfotech.com/career/'
export const VACANCY_HUB_URL = 'https://beta.prdcinfotech.com/category-wise-vacancy/'
export const ALL_CATEGORIES_URL = 'https://beta.prdcinfotech.com/job-listing-all-categories/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/&reg;|&#174;/gi, '')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*CAREERS\s*&#8211;\s*prdcinfotech\s*<\/title>/i.test(rawHtml)
    && /<link rel="canonical" href="https:\/\/beta\.prdcinfotech\.com\/career\/"/i.test(rawHtml)
    && normalized.includes('Career Path with PRDC')
    && normalized.includes('Equal opportunity to all qualified individuals.')
    && normalized.includes('Supporting your career growth and ambitions.')
}

export const extractVacancyHubUrl = (html) => {
  const rawHtml = String(html ?? '')

  for (const match of rawHtml.matchAll(/<a[^>]+href="([^"]*category-wise-vacancy[^"]*)"[^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl) return absoluteUrl
  }

  return null
}

export const hasOfficialVacancyHubSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Category-wise Vacancy\s*&#8211;\s*prdcinfotech\s*<\/title>/i.test(rawHtml)
    && /<link rel="canonical" href="https:\/\/beta\.prdcinfotech\.com\/category-wise-vacancy\/"/i
      .test(rawHtml)
    && normalized.includes('Category-wise Vacancy')
    && /job-listing-electrical/i.test(rawHtml)
    && /job-listing-marketing/i.test(rawHtml)
    && /job-listing-software/i.test(rawHtml)
}

export const extractAllCategoriesUrl = (html) => {
  const rawHtml = String(html ?? '')

  for (const match of rawHtml.matchAll(/<a[^>]+href="([^"]*job-listing-all-categories[^"]*)"[^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], VACANCY_HUB_URL)
    if (absoluteUrl) return absoluteUrl.replace(/^http:\/\//i, 'https://')
  }

  return null
}

export const hasOfficialAllCategoriesSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return normalized.includes('Job Listing - ALL CATEGORIES - prdcinfotech')
    && /<link rel="canonical" href="https:\/\/beta\.prdcinfotech\.com\/job-listing-all-categories\/"/i
      .test(rawHtml)
    && /<th[^>]*>\s*Title\s*<\/th>\s*<th[^>]*>\s*Domain\s*<\/th>\s*<th[^>]*>\s*Experience\s*<\/th>\s*<th[^>]*>\s*Location\s*<\/th>/i
      .test(rawHtml)
}

export const extractJobsFromAllCategoriesPage = (html, { scrapedAt = new Date().toISOString() } = {}) => (
  [...String(html ?? '').matchAll(
    /<tr>\s*<td><a[^>]*>([\s\S]*?)<\/a><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td><a[^>]*>\s*Apply\s*<\/a><\/td>\s*<\/tr>/gi,
  )]
    .map((match) => {
      const title = normalizeWhitespace(match[1])
      const department = normalizeWhitespace(match[2])
      const experienceRequired = normalizeWhitespace(match[3])
      const location = normalizeWhitespace(match[4])
      const jobId = slugify(title)

      if (!title || !department || !experienceRequired || !location || !jobId) return null

      return {
        title,
        company: COMPANY,
        location,
        city: location,
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: ALL_CATEGORIES_URL,
        applyUrl: null,
        department,
        employmentType: 'Full-time',
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: [
          `Domain: ${department}`,
          `Experience: ${experienceRequired}`,
          `Location: ${location}`,
        ].join('\n'),
        source: SOURCE,
        link: ALL_CATEGORIES_URL,
        scrapedAt,
      }
    })
    .filter(Boolean)
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPrdcPrivateLimitedScraper = ({ now = () => new Date() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('PRDC verified official careers page no longer matches the known public surface')
    }

    const vacancyHubUrl = extractVacancyHubUrl(careersHtml)
    if (vacancyHubUrl !== VACANCY_HUB_URL) {
      throw new Error('PRDC verified careers page no longer links to the expected vacancy hub')
    }

    const vacancyHubHtml = await fetchText(vacancyHubUrl)
    if (!hasOfficialVacancyHubSignal(vacancyHubHtml)) {
      throw new Error('PRDC verified vacancy hub no longer matches the known public surface')
    }

    const allCategoriesUrl = extractAllCategoriesUrl(vacancyHubHtml)
    if (allCategoriesUrl !== ALL_CATEGORIES_URL) {
      throw new Error('PRDC verified vacancy hub no longer links to the expected all-categories jobs page')
    }

    const allCategoriesHtml = await fetchText(allCategoriesUrl)
    if (!hasOfficialAllCategoriesSignal(allCategoriesHtml)) {
      throw new Error('PRDC verified all-categories jobs page no longer matches the known public surface')
    }

    const jobs = extractJobsFromAllCategoriesPage(allCategoriesHtml, {
      scrapedAt: now().toISOString(),
    })

    if (jobs.length === 0) {
      throw new Error('PRDC all-categories page returned no public jobs; verify whether the surface changed')
    }

    return jobs
  },
})

export const run = async (options = {}) => createPrdcPrivateLimitedScraper().run(options)

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
