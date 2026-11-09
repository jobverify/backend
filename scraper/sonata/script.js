import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'sonata'
export const COMPANY = 'Sonata Software'
export const CAREERS_URL = 'https://www.sonata-software.com/careers'
export const JOB_LISTINGS_URL = 'https://dev2024.sonata-software.com/careers/job-postings'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u2019/g, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/thead|\/tbody|\/tr|\/td|\/th)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol|table|thead|tbody|tr|td|th)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = JOB_LISTINGS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const primaryLocation = normalized.split('/')[0]?.split(',')[0]?.trim()
  return primaryLocation || normalized
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/year/i.test(normalized)) return normalized
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return `${normalized} years`
  return normalized
}

const parseSkills = (value) => normalizeWhitespace(value)
  ?.split(',')
  .map((skill) => normalizeWhitespace(skill))
  .filter(Boolean) || []

const extractJobListingsTable = (html) =>
  String(html ?? '').match(/<table[^>]*class="table table-hover table-striped views-table views-view-table cols-5"[\s\S]*?<\/table>/i)?.[0]
  || null

export const hasOfficialSonataJobListingsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Job listings\s*\|\s*Sonata Software\s*<\/title>/i.test(page)
    && text.includes('Job listings')
    && text.includes('Title')
    && text.includes('Skill')
    && text.includes('Years of Experience')
    && text.includes('Locations')
    && text.includes('Requirement ID')
    && page.includes('/careers/applynow')
}

export const extractSearchResults = (html = '') => {
  const tableHtml = extractJobListingsTable(html)
  if (!tableHtml) return []

  const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => [...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => cell[1]))
    .filter((cells) => cells.length === 5)
    .slice(1)

  return rows.map((cells) => {
    const titleMatch = cells[0].match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    const requirementMatch = cells[4].match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)

    const title = stripTags(titleMatch?.[2])
    const sourceUrl = toAbsoluteUrl(titleMatch?.[1], JOB_LISTINGS_URL)
    const requirementId = stripTags(requirementMatch?.[2])
    const applyUrl = toAbsoluteUrl(requirementMatch?.[1], JOB_LISTINGS_URL) || sourceUrl
    const skill = stripTags(cells[1])
    const experienceRequired = normalizeExperience(stripTags(cells[2]))
    const rawLocation = stripTags(cells[3])
    const location = rawLocation ? `${rawLocation}, India` : null

    if (!title || !sourceUrl || !applyUrl || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(rawLocation),
      country: 'India',
      jobId: requirementId || title,
      requisitionId: requirementId || null,
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: parseSkills(skill),
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    }
  }).filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSonataScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const html = await fetchText(JOB_LISTINGS_URL)

    if (!hasOfficialSonataJobListingsSignal(html)) {
      throw new Error('Sonata official job listings page no longer matches the verified first-party public surface')
    }

    const jobs = extractSearchResults(html)
    if (jobs.length === 0) {
      throw new Error('Sonata official job listings page no longer exposes parseable public India rows')
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSonataScraper(options).run(options)

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
