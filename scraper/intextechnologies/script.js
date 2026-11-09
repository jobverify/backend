import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { INTEX_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INTEX_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const COMMENT_PATTERN = /<!--[\s\S]*?-->/g
const CARD_PATTERN =
  /<div[^>]*border:\s*1px[^>]*>[\s\S]*?<p[^>]*font-size:\s*20px[^>]*>\s*([^<]+?)\s*<\/p>[\s\S]*?<div[^>]*display:\s*none[^>]*>([\s\S]*?)<a[^>]+href="(https:\/\/forms\.gle\/[^"]+)"[^>]*>\s*Apply Now\s*<\/a>/gi

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const cleanLine = (value) => stripTags(value).replace(/^[\u2022*-]\s*/, '').trim()

const htmlToLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|ul|ol|h[1-6]|section|article|main)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => cleanLine(line))
  .filter(Boolean)

const slugify = (value) => cleanLine(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const stripComments = (html) => String(html ?? '').replace(COMMENT_PATTERN, '')

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const parseLabelValue = (lines, labels) => {
  for (const label of labels) {
    const pattern = new RegExp(`^${label}\\s*:`, 'i')
    const line = lines.find((item) => pattern.test(item))
    if (!line) continue
    return cleanLine(line.replace(pattern, ''))
  }

  return null
}

const normalizeLocation = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const extractRequiredSkills = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return []

  return normalized
    .split(',')
    .map((item) => cleanLine(item))
    .filter(Boolean)
}

const buildJobDescription = (lines) => {
  const descriptionLines = lines.filter((line) =>
    !/^(location|experience|skills)\s*:/i.test(line)
    && !/^job description\s*:?\s*$/i.test(line)
    && !/^apply now$/i.test(line),
  )

  return normalizeOptionalValue(descriptionLines.join(' '))
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Intex Technologies scraper')
  }

  return parsed.toISOString()
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const page = stripComments(html)

  return /intex careers/i.test(page)
    && /job openings/i.test(page)
    && /forms\.gle\//i.test(page)
    && /branch sales manager/i.test(page)
}

export const extractApplyUrls = (html) => [...stripComments(html).matchAll(/https:\/\/forms\.gle\/[^"'\\s<]+/gi)]
  .map((match) => match[0])
  .filter((value, index, values) => values.indexOf(value) === index)

export const extractVisibleJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified Intex Technologies careers page with public openings')
  }

  const visibleHtml = stripComments(html)
  const jobs = []

  for (const match of visibleHtml.matchAll(CARD_PATTERN)) {
    const [, rawTitle, rawDetailsHtml, rawApplyUrl] = match
    const title = cleanLine(rawTitle)
    const slug = slugify(title)
    const lines = htmlToLines(rawDetailsHtml)
    const rawLocation = parseLabelValue(lines, ['Location'])
    const skills = extractRequiredSkills(parseLabelValue(lines, ['Skills']))

    if (!title || !slug || !rawApplyUrl) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: normalizeLocation(rawLocation),
      city: null,
      country: 'India',
      jobId: slug,
      requisitionId: slug,
      sourceUrl: `${CAREERS_PAGE_URL}#${slug}`,
      applyUrl: rawApplyUrl,
      employmentType: null,
      experienceRequired: parseLabelValue(lines, ['Experience']),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: skills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(lines),
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length === 0) {
    throw new Error('Expected verified Intex Technologies careers page with public openings')
  }

  return jobs
}

export const createIntexTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, maxJobs: overrideMaxJobs, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Expected verified Intex Technologies careers page with public openings')
    }

    const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
    const jobs = extractVisibleJobs(careersHtml)
    const selectedJobs = limit ? jobs.slice(0, limit) : jobs
    const scrapedAt = normalizeScrapedAt((overrideNow || now)())

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createIntexTechnologiesScraper().run(options)

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
