import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'upstox'
export const COMPANY_NAME = 'Upstox'
export const COMPANY = COMPANY_NAME
export const VERIFIED_ON = '2026-07-25'
export const OFFICIAL_SITE_URL = 'https://upstox.com/'
export const CAREERS_PAGE_URL = 'https://upstox.com/careers/'

const CARD_PATTERN =
  /<div class="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:bg-gray-50 hover:shadow-md">([\s\S]*?)<div class="absolute left-0 top-0 h-full w-1 origin-top scale-y-0 transform/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripComments(value))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const matchGroup = (value, pattern) => {
  const match = String(value ?? '').match(pattern)
  return normalizeWhitespace(match?.[1])
}

const normalizeComparableTitle = (value) => normalizeWhitespace(value)?.replace(/\s*-\s*/g, ' - ') || null

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^onsite$/i.test(normalized)) return 'On-site'
  return normalized
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractJobCards = (html = '') => [
  ...String(html ?? '').matchAll(CARD_PATTERN),
].map((match) => match[1])

export const extractBadgeTexts = (cardHtml = '') => [
  ...String(cardHtml ?? '').matchAll(
    /<span class="inline-flex items-center rounded-md bg-gray-100 px-2\.5 py-1 text-xs text-gray-700">([\s\S]*?)<\/span>/gi,
  ),
].map((match) => normalizeWhitespace(match[1])).filter(Boolean)

const extractExperienceRequired = (badges, summary) => {
  const experienceBadge = badges.find((badge) =>
    /\byears of experience\b/i.test(badge) || /^Relevant experience required$/i.test(badge),
  )
  if (experienceBadge) return experienceBadge

  const summaryMatch = String(summary ?? '').match(/Experience required:\s*([^\.]+)\./i)
  return normalizeWhitespace(summaryMatch?.[1]) || null
}

const buildJobDescription = ({
  summary,
  location,
  remoteStatus,
  employmentType,
  experienceRequired,
  postedLabel,
}) => [
  summary,
  location ? `Verified location: ${location}.` : null,
  remoteStatus ? `Work model: ${remoteStatus}.` : null,
  employmentType ? `Employment type: ${employmentType}.` : null,
  experienceRequired ? `Experience: ${experienceRequired}.` : null,
  postedLabel ? `Posted: ${postedLabel}.` : null,
].filter(Boolean).join(' ')

const cardToJob = (cardHtml = '') => {
  const title = matchGroup(cardHtml, /<h3[^>]*>([\s\S]*?)<\/h3>/i)
  if (!title) return null

  const department = matchGroup(cardHtml, /lucide-building2[\s\S]*?<\/svg>\s*<span>([\s\S]*?)<\/span>/i)
  const shortLocation = matchGroup(cardHtml, /lucide-map-pin[\s\S]*?<\/svg>\s*<span>([\s\S]*?)<\/span>/i)
  const employmentType = matchGroup(cardHtml, /lucide-briefcase[\s\S]*?<\/svg>\s*<span>([\s\S]*?)<\/span>/i)
  const postedLabel = matchGroup(cardHtml, /<span>\s*Posted[\s\S]*?([A-Za-z]{3}\s+\d{1,2})\s*<\/span>/i)
  const summary = matchGroup(cardHtml, /<p class="line-clamp-2 text-sm text-gray-600">([\s\S]*?)<\/p>/i)
  const remoteStatus = normalizeRemoteStatus(
    matchGroup(cardHtml, /<span class="rounded-full bg-blue-50 px-2\.5 py-0\.5 text-xs font-medium text-blue-700">([\s\S]*?)<\/span>/i),
  )
  const badges = extractBadgeTexts(cardHtml)
  const detailedLocation = badges.find((badge) => /^Location:\s*/i.test(badge))
    ?.replace(/^Location:\s*/i, '')
    ?.trim()
  const location = detailedLocation || (shortLocation ? `${shortLocation}, India` : null)
  const experienceRequired = extractExperienceRequired(badges, summary)
  const jobId = slugify(title)
  const sourceUrl = `${CAREERS_PAGE_URL}#${jobId}`

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: shortLocation?.split(',')[0]?.trim() || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      summary,
      location,
      remoteStatus,
      employmentType,
      experienceRequired,
      postedLabel,
    }) || null,
    remoteStatus,
  }
}

export const extractJobsFromPage = (html = '') =>
  extractJobCards(html)
    .map((cardHtml) => cardToJob(cardHtml))
    .filter(Boolean)

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return normalizeComparableTitle(extractTitle(page)) === 'Careers - Latest Opening at Upstox'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/upstox\.com\/careers\/["']/i.test(page)
    && /Search jobs by title, department, or location\.\.\./i.test(page)
    && /\bopen positions\b/i.test(page)
    && extractJobCards(page).length >= 2
}

export const createUpstoxScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('The verified Upstox careers page changed materially')
    }

    const jobs = extractJobsFromPage(careersHtml)
    if (jobs.length === 0) {
      throw new Error('The verified Upstox careers page no longer exposes public job cards')
    }

    const scrapedAt = now()

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createUpstoxScraper().run(options)

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
