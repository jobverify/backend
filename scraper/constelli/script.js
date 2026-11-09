import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.constelli.com/careers/'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractLocation = (value) => {
  const text = normalizeWhitespace(value) || ''
  if (/\b(bangalore|bengaluru)\b/i.test(text)) {
    return { city: 'Bangalore', location: 'Bangalore, India' }
  }
  if (/\bhyderabad\b/i.test(text)) {
    return { city: 'Hyderabad', location: 'Hyderabad, India' }
  }
  return { city: null, location: 'India' }
}

export const extractJobCards = (html) => String(html ?? '')
  .split(/<div\b[^>]*class=["'][^"']*\bjob-card\b[^"']*["'][^>]*>/i)
  .slice(1)
  .map((card) => {
    const title = normalizeWhitespace(
      card.match(/<button\b[^>]*class=["'][^"']*\baccordion\b[^"']*["'][^>]*>([\s\S]*?)<span\b/i)?.[1],
    )
    const jobDescription = normalizeWhitespace(
      card.match(/<div\b[^>]*class=["'][^"']*\bjob-desc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const location = extractLocation(card)
    const jobId = slugify(title)

    if (!title || !jobDescription || !location || !jobId) return null

    return {
      title,
      company: 'Constelli Signals Private Limited',
      department: null,
      location: location.location,
      city: location.city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: 'On-site',
      compensation: null,
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createConstelliScraper = ({ fetchText = defaultFetchText } = {}) => ({
  run: async ({ fetchText: overrideFetchText } = {}) => {
    const jobs = extractJobCards(await (overrideFetchText || fetchText)(CAREERS_URL))

    return jobs.map((job) => ({
      ...job,
      source: 'constelli',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createConstelliScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'constelli')
}
