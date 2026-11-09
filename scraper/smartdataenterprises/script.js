import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import SMARTDATA_ENTERPRISES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SMARTDATA_ENTERPRISES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
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

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const getSpecification = (card, type) => stripTags(
  card.match(new RegExp(
    `<div\\b[^>]*class=["'][^"']*awsm-job-specification-${type}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  ))?.[1],
)

const deriveCity = (value) => normalizeWhitespace(
  String(value ?? '')
    .split(',')[0]
    .split('/')[0],
)

const isTrustedIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/remote|work-from-home/i.test(normalized)) return false
  return true
}

const sortJobs = (jobs) => [...jobs].sort((left, right) =>
  String(left.title || '').localeCompare(String(right.title || ''), 'en', { sensitivity: 'base' }))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /smartData Careers/i.test(page)
    && /Current Openings/i.test(page)
    && /awsm-job-listing-item/i.test(page)
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*>|<\/body>)/gi,
)]
  .map((match) => {
    const card = match[0]
    const detailUrl = normalizeWhitespace(
      card.match(/<a\b[^>]*class=["'][^"']*awsm-job-more[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1]
      || card.match(/<h2\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["']/i)?.[1],
    )
    const title = stripTags(
      card.match(/<h2\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1],
    )
    const location = normalizeWhitespace(
      getSpecification(card, 'job-location')?.replace(/^Location:\s*/i, ''),
    )
    const employmentType = getSpecification(card, 'job-type')
    const experienceRequired = getSpecification(card, 'job-experience')
    const jobDescription = stripTags(
      card.match(/<div\b[^>]*class=["'][^"']*full-desc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const jobId = detailUrl
      ? detailUrl.replace(/\/$/, '').split('/').pop()
      : null

    if (!title || !location || !detailUrl || !jobId) return null

    return {
      title,
      company: COMPANY,
      location,
      city: deriveCity(location),
      country: null,
      jobId,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      detailUrl,
      applyUrl: detailUrl,
      department: null,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    }
  })
  .filter(Boolean)

export const createSmartDataEnterprisesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now: overrideNow = now,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('smartData Enterprises verified first-party careers page no longer matches the expected AWSM listings surface')
    }

    const jobs = extractJobCards(careersHtml)
      .filter((job) => isTrustedIndiaLocation(job.location))
      .map((job) => ({
        ...job,
        location: `${job.city}, India`,
        country: 'India',
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: overrideNow(),
      }))

    return Number.isFinite(maxJobs) ? sortJobs(jobs).slice(0, maxJobs) : sortJobs(jobs)
  },
})

export const run = async (options = {}) => createSmartDataEnterprisesScraper(options).run(options)

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
