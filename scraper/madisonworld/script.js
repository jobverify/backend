import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'madisonworld'
export const COMPANY = 'Madison World'
export const HOMEPAGE_URL = 'https://madisonindia.com/'
export const CAREERS_PAGE_URL = 'https://madisonindia.com/careers'
export const APPLY_URL = `${CAREERS_PAGE_URL}#careerform`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const parseNextData = (html) => {
  const match = String(html ?? '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return []

  try {
    const payload = JSON.parse(match[1])
    return Array.isArray(payload?.props?.pageProps?.jobs) ? payload.props.pageProps.jobs : []
  } catch {
    return []
  }
}

const toLocation = (city) => {
  const normalized = normalizeWhitespace(city)
  if (!normalized) return { location: null, city: null, country: null }
  return {
    location: `${normalized}, India`,
    city: normalized,
    country: 'India',
  }
}

const buildJobDescription = (job = {}) => {
  const attributes = job.attributes || {}
  const parts = [
    attributes.tag,
    attributes.years,
    attributes.positions ? `${attributes.positions} positions` : null,
    attributes.city,
  ]

  return parts.map((part) => normalizeWhitespace(part)).filter(Boolean).join(' - ') || null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /Madison World/i.test(page)
    && /href="\/careers"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && /You can drop in your resume and portfolio/i.test(page)
    && parseNextData(page).length > 0
}

export const extractJobsFromNextData = (html) => parseNextData(html)
  .map((job) => {
    const attributes = job?.attributes || {}
    const title = normalizeWhitespace(attributes.title)
    const jobId = job?.id == null ? null : String(job.id)
    const locationData = toLocation(attributes.city)

    if (!title || !jobId || !locationData.location) return null

    return {
      title,
      company: COMPANY,
      department: normalizeWhitespace(attributes.tag),
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: APPLY_URL,
      employmentType: null,
      experienceRequired: normalizeWhitespace(attributes.years),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(attributes.publishedAt),
      closingDate: null,
      jobDescription: buildJobDescription(job),
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const page = await fetchPageWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  return page.html
}

export const createMadisonWorldScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Madison World homepage no longer matches the verified official homepage surface')
    }

    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Madison World careers page no longer matches the verified official careers surface')
    }

    const jobs = extractJobsFromNextData(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createMadisonWorldScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Madison World jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
