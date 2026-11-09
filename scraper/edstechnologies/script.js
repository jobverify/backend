import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://edstechnologies.com/careers/'
export const APPLICATION_EMAIL = 'careers@edstechnologies.com'
export const SOURCE = 'edstechnologies'

const COMPANY = 'EDS Technologies Pvt. Ltd.'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/thead|\/tbody|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol|table|thead|tbody|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractHref = (html) => String(html ?? '').match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || null

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREER_PAGE_URL).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^pan india$/i.test(normalized) || /\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /^pan india$/i.test(normalized) || /\bindia\b/i.test(normalized)) {
    return null
  }

  const parts = normalized
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return parts.length === 1 ? parts[0] : null
}

const buildJobDescription = ({ title, department, location, applyUrl }) => {
  if (applyUrl?.startsWith('mailto:')) {
    return normalizeWhitespace(
      `Official ${COMPANY} opening for ${title} in ${department} at ${location}. Apply by emailing ${APPLICATION_EMAIL}.`,
    )
  }

  return normalizeWhitespace(
    `Official ${COMPANY} opening for ${title} in ${department} at ${location}. Refer to the first-party job description PDF for role details and application instructions.`,
  )
}

const extractOpeningTable = (html) => {
  const tables = [...String(html ?? '').matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
  return tables.find((match) => {
    const text = stripTags(match[0]) || ''
    return (
      /Job Openings/i.test(String(html ?? ''))
      && /Job Title/i.test(text)
      && /Discipline/i.test(text)
      && /Location/i.test(text)
      && /Apply Now/i.test(text)
    )
  })?.[0] || null
}

const extractRows = (tableHtml) => [...String(tableHtml ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => [...match[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => cell[1]))
  .filter((cells) => cells.length >= 4)

export const pageIndicatesJobOpenings = (html) => Boolean(extractOpeningTable(html))

export const extractOpenings = (html) => {
  const tableHtml = extractOpeningTable(html)
  if (!tableHtml) {
    throw new Error('EDS Technologies careers page no longer exposes the expected openings table')
  }

  const jobs = extractRows(tableHtml)
    .map((cells) => {
      const title = stripTags(cells[0])
      const department = stripTags(cells[1])
      const rawLocation = stripTags(cells[2])
      const applyCellHref = toAbsoluteUrl(extractHref(cells[3]))

      if (!title || !department || !rawLocation) return null
      if (/^job title$/i.test(title) && /^discipline$/i.test(department)) return null

      const location = normalizeLocation(rawLocation)
      const city = extractCity(rawLocation)
      const jobKey = slugify([title, department, rawLocation].join(' '))
      const jobId = `${SOURCE}-${jobKey}`

      return {
        title,
        company: COMPANY,
        department,
        location,
        city,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: applyCellHref || CAREER_PAGE_URL,
        applyUrl: applyCellHref || `mailto:${APPLICATION_EMAIL}`,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: buildJobDescription({
          title,
          department,
          location,
          applyUrl: applyCellHref || `mailto:${APPLICATION_EMAIL}`,
        }),
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('EDS Technologies careers page no longer exposes the expected openings table')
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

export const createEdsTechnologiesScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)
    const jobs = extractOpenings(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createEdsTechnologiesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EDS Technologies scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
