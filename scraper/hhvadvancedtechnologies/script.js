import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'hhvadvancedtechnologies'
export const COMPANY = 'HHV Advanced Technologies'
export const HOMEPAGE_URL = 'https://hhvadvancedtech.com/'
export const CAREERS_URL = 'https://hhvadvancedtech.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ACCORDION_ITEM_START_PATTERN =
  /<div class="[^"]*\baccordion_[^"]*"[^>]*data-accordion-item="(\d+)"[^>]*>/gi

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const htmlToLines = (value) => {
  const text = decodeHtml(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span[^>]*class="[^"]*\bw-text-block\b[^"]*"[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
}

const extractAccordionBlocks = (html) => {
  const page = String(html ?? '')
  const matches = [...page.matchAll(ACCORDION_ITEM_START_PATTERN)]

  return matches.map((match, index) => {
    const start = match.index
    const end = matches[index + 1]?.index ?? page.length
    return page.slice(start, end)
  })
}

const extractLabeledValue = (lines, label) => {
  const line = lines.find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`))
  if (!line) return null

  return normalizeWhitespace(line.slice(label.length + 1))
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/[&/]| and /i.test(normalized)) return null

  return normalized.split(',').map((part) => normalizeWhitespace(part)).find(Boolean) ?? null
}

const extractJobDescription = (lines) => {
  const startIndex = lines.findIndex((line) => /^Job Description:?$/i.test(line))
  const applyIndex = lines.findIndex((line) => /^APPLY NOW$/i.test(line))

  if (startIndex === -1) return null

  const descriptionLines = lines
    .slice(startIndex + 1, applyIndex === -1 ? undefined : applyIndex)
    .map((line) => normalizeWhitespace(line.replace(/^●\s*/u, '')))
    .filter(Boolean)

  return normalizeWhitespace(descriptionLines.join(' '))
}

const extractApplyUrl = (block) => {
  const match = String(block ?? '').match(/href="(https:\/\/hhvadvancedtech\.com\/apply-now\?post=[^"]+)"/i)
  if (!match) return null

  try {
    return new URL(decodeHtml(match[1])).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Optical Component Manufacturer\s*\|\s*Thin Film Technology\s*<\/title>/i.test(page)
    && /<meta[^>]+property="og:title"[^>]+content="HHV Advanced Technologies"/i.test(page)
    && /href="\/careers"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*HHV Advanced Tech\s*<\/title>/i.test(page)
    && /href="\/careers#current-openings"/i.test(page)
    && /The following are the current openings at HHV Advanced Technologies\./i.test(page)
    && /data-accordion-item="/i.test(page)
    && /accordion__heading/i.test(page)
    && /https:\/\/hhvadvancedtech\.com\/apply-now\?post=/i.test(page)
}

export const extractJobsFromCareersPage = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('HHV Advanced Technologies careers page no longer matches the verified official public careers surface')
  }

  const jobs = extractAccordionBlocks(html).map((block) => {
    const title = stripTags(
      block.match(/<h3[^>]*class="[^"]*accordion__heading[^"]*"[^>]*>([\s\S]*?)<\/h3>/i)?.[1],
    )
    const applyUrl = extractApplyUrl(block)
    const lines = htmlToLines(block)

    if (!title || !applyUrl || lines.length === 0) return null

    return {
      title,
      company: COMPANY,
      department: extractLabeledValue(lines, 'Department'),
      location: extractLabeledValue(lines, 'Location'),
      city: deriveCity(extractLabeledValue(lines, 'Location')),
      state: null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: extractLabeledValue(lines, 'Years of Experience'),
      minimumQualification: extractLabeledValue(lines, 'Education Qualification'),
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: extractJobDescription(lines),
      remoteStatus: 'On-site',
    }
  }).filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('HHV Advanced Technologies verified public careers page no longer exposes parseable openings')
  }

  for (const job of jobs) {
    if (!job.jobId || !job.applyUrl || !job.location || !job.jobDescription) {
      throw new Error('HHV Advanced Technologies verified careers accordion markup changed')
    }
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHhvAdvancedTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('HHV Advanced Technologies homepage no longer matches the verified official careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractJobsFromCareersPage(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createHhvAdvancedTechnologiesScraper().run(options)

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
