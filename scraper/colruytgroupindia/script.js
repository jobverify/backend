import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://careers.in.colruytgroup.com/jobs/careers'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const buildJobUrl = ({ id, title }) => {
  const slug = encodeURIComponent(title).replace(/%20/g, '-')
  return `${CAREERS_URL.replace(/\/jobs\/careers$/i, `/jobs/Careers/${id}/${slug}`)}?source=CareerSite`
}

const extractJobsPayload = (html) => {
  const input = /<input\b(?=[^>]*\bid=["']jobs["'])[^>]*\bvalue=(["'])([\s\S]*?)\1[^>]*>/i.exec(
    String(html ?? ''),
  )

  if (!input) return []

  try {
    const payload = JSON.parse(decodeHtmlEntities(input[2]))
    return Array.isArray(payload) ? payload : []
  } catch {
    return []
  }
}

export const extractZohoCareerJobs = (html) => extractJobsPayload(html)
  .map((job) => {
    const title = normalizeWhitespace(job.Posting_Title || job.Job_Opening_Name)
    const city = normalizeWhitespace(job.City)
    const country = normalizeWhitespace(job.Country)
    const jobId = normalizeWhitespace(job.id)

    if (!title || !city || country?.toLowerCase() !== 'india' || !jobId) return null

    const sourceUrl = buildJobUrl({ id: jobId, title })

    return {
      jobId,
      requisitionId: jobId,
      title,
      location: `${city}, India`,
      city,
      country: 'India',
      employmentType: normalizeWhitespace(job.Job_Type),
      experienceRequired: normalizeWhitespace(job.Work_Experience),
      jobDescription: normalizeWhitespace(job.Job_Description),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      sourceUrl,
      applyUrl: sourceUrl,
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createColruytGroupIndiaScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const html = await (overrideFetchText || fetchText)(CAREERS_URL)

    return extractZohoCareerJobs(html).map((job) => ({
      ...job,
      company: 'Colruyt Group India',
      source: 'colruytgroupindia',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createColruytGroupIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'colruytgroupindia')
  }
}
