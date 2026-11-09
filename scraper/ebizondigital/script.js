import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateSourceDescriptions, sourceDescriptionFromPosting } from '../../scraper-support/utils/sourceDescriptionHydration.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://www.ebizondigital.com/careers/'
export const BOARD_URL = 'https://ebizon.applytojob.com/apply'

const COMPANY = 'EbizON Digital'
const SOURCE = 'ebizondigital'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const BOARD_HOST = new URL(BOARD_URL).hostname
const BOARD_PATH = new URL(BOARD_URL).pathname.replace(/\/$/, '')
const INDIA_LOCATION_PATTERN =
  /\b(?:india|noida|dehradun|gurugram|gurgaon|uttar pradesh|uttarakhand|haryana|delhi|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|kolkata|ahmedabad)\b/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtml = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const stripToLines = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|section|article|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[–—]/g, '-')
  .replace(/\u00a0/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractTitle = (html) => normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const toAbsoluteBoardUrl = (value) => {
  try {
    const url = new URL(value, BOARD_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (url.hostname !== BOARD_HOST) return null
    if (url.pathname !== BOARD_PATH && !url.pathname.startsWith(`${BOARD_PATH}/`)) return null
    return url.href.split('#')[0]
  } catch {
    return null
  }
}

const extractJobId = (url) => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    const applyIndex = segments.indexOf('apply')
    return applyIndex >= 0 ? segments[applyIndex + 1] || null : null
  } catch {
    return null
  }
}

const normalizeTitle = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/\bll\b/gi, 'II')
    .replace(/\s+/g, ' '),
)

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  if (/^remote$/i.test(location)) return 'Remote, India'
  return location
}

const getCity = (location) => {
  if (!location || /^remote\b/i.test(location)) return null
  return normalizeWhitespace(location.split(',')[0])
}

const getRemoteStatus = (location) => (/^remote\b/i.test(location || '') ? 'Remote' : 'On-site')

const isIndiaOrRemote = (location) => /^remote\b/i.test(location || '') || INDIA_LOCATION_PATTERN.test(location || '')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = decodeHtml(page) || ''

  return extractTitle(page) === 'Careers | EbizON'
    && /EbizON Seeks Out Driven A Class Members That Crave Solving Unique Technical & Marketing Problems\./i.test(text)
    && /Current Openings/i.test(text)
    && /EbizON Digital Headquarters/i.test(text)
    && /Dehradun Development Center/i.test(text)
    && page.includes(BOARD_URL)
  }

export const hasVerifiedBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = decodeHtml(page) || ''

  return extractTitle(page) === 'Ebizon - Career Page'
    && /Thanks for visiting our Career Page\./i.test(text)
    && /Current Openings/i.test(text)
    && /View Our Website/i.test(text)
    && /https:\/\/www\.ebizondigital\.com/i.test(page)
}

export const extractBoardJobs = (html) => {
  const seen = new Set()
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<h3[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>([\s\S]*?)(?=<h3\b|<\/li>|$)/gi,
  )) {
    const applyUrl = toAbsoluteBoardUrl(match[1])
    const title = normalizeTitle(match[2])
    const lines = stripToLines(match[3])
    const location = normalizeLocation(lines[0])
    const jobId = applyUrl ? extractJobId(applyUrl) : null

    if (!applyUrl || !title || !location || !jobId || seen.has(applyUrl) || !isIndiaOrRemote(location)) {
      continue
    }

    seen.add(applyUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: getCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: getRemoteStatus(location),
    })
  }

  return jobs
}

const defaultFetchText = (url, { signal, includeResponseMetadata = false } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
  includeResponseMetadata,
})

export const createEbizOnDigitalScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, signal, detailEnrichmentBudgetMs } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The official EbizON careers page no longer matches the verified public surface')
    }

    signal?.throwIfAborted()
    const boardHtml = await fetchText(BOARD_URL, { signal })

    if (!hasVerifiedBoardSignal(boardHtml)) {
      throw new Error('The verified EbizON ApplyToJob board no longer matches the expected public surface')
    }

    const jobs = extractBoardJobs(boardHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    const decorated = selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
    return hydrateSourceDescriptions(decorated, {
      signal, detailEnrichmentBudgetMs,
      fetchDetail: async (job, { signal }) => sourceDescriptionFromPosting(job,
        await fetchText(job.sourceUrl, { signal, includeResponseMetadata: true }),
        { employerAliases: ['EbizON', 'Ebizon'], normalizeTitle }),
    })
  },
})

export const run = async (options = {}) => createEbizOnDigitalScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EbizON Digital scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
