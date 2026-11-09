import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://exposysdata.com/careers.html'
export const INTERNSHIP_PAGE_URL = 'https://exposysdata.com/internship.html'
export const REGISTRATION_URL = 'https://exposysdata.com/registration.php'
export const APPLICATION_EMAIL = 'hr@exposysdata.com'

const SOURCE = 'exposysdatalabs'
const COMPANY = 'Exposys Data Labs'

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
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const htmlToLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|h[1-6]|ul|ol|section|article|main)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const normalizeCity = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (['bangalore', 'bengaluru', 'bangaluru'].includes(normalized)) return 'Bengaluru'
  return normalizeWhitespace(value)
}

const parseLocation = (value) => {
  const city = normalizeCity(value)
  if (!city) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  return {
    location: `${city}, India`,
    city,
    country: 'India',
  }
}

const extractExperience = (title) => {
  const normalized = normalizeWhitespace(title)
  if (!normalized) return null

  const fresherMatch = normalized.match(/(?:^|[-–])\s*(Fresher)\.?$/i)
  if (fresherMatch) return 'Fresher'

  const experienceMatch = normalized.match(/(?:^|[-–])\s*([0-9+]+\s*years?\s+of\s+experience)\.?$/i)
  return normalizeWhitespace(experienceMatch?.[1]) || null
}

export const pageIndicatesExposysCareers = (html) => {
  const page = String(html ?? '')
  return (
    /Our current openings\./i.test(page)
    && /mailto:hr@exposysdata\.com/i.test(page)
  )
}

export const extractCareerJobs = (html) => {
  if (!pageIndicatesExposysCareers(html)) {
    throw new Error('Exposys Data Labs careers page no longer exposes the expected public openings')
  }

  const jobs = htmlToLines(html)
    .map((line) => {
      const match = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
      if (!match) return null

      const title = normalizeWhitespace(match[1])
      const locationData = parseLocation(match[2])
      const isInternship = /\binternship\b/i.test(title || '')
      const jobId = slugify(`${SOURCE}-${title}`)

      if (!title || !locationData.location || !jobId) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: isInternship ? INTERNSHIP_PAGE_URL : CAREERS_PAGE_URL,
        applyUrl: isInternship ? REGISTRATION_URL : `mailto:${APPLICATION_EMAIL}`,
        employmentType: isInternship ? 'Internship' : null,
        experienceRequired: isInternship ? null : extractExperience(title),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: isInternship
          ? 'Apply through the Exposys Data Labs internship registration form.'
          : `Apply by emailing ${APPLICATION_EMAIL}.`,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Exposys Data Labs careers page no longer exposes the expected public openings')
  }

  return jobs
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createExposysDataLabsScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const jobs = extractCareerJobs(
      await (overrideFetchText || fetchText)(CAREERS_PAGE_URL),
    )

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createExposysDataLabsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Exposys Data Labs jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
