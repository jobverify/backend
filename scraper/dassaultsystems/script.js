import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.3ds.com/careers/jobs'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractCity = (location) => {
  const parts = String(location ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  return parts.at(-1) || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), CAREER_PAGE_URL).toString()
  } catch {
    return null
  }
}

const extractJobId = (url) => /-(\d+)\/?(?:[?#].*)?$/i.exec(url ?? '')?.[1] || null

const extractCardFields = (cardHtml) => {
  const linkMatch = /<a\b[^>]*href=["']([^"']*\/careers\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml)
  const text = normalizeWhitespace(cardHtml)
  const location = /\bIndia\s*,\s*[^,<>]+?\s*,\s*[^,<>]+?(?=\s+(?:Apprenticeship|Fixed Term Contract|Graduate Program|Internship|Regular)\b|$)/i.exec(text)?.[0] || null
  const type = /\b(Apprenticeship|Fixed Term Contract|Graduate Program|Internship|Regular)\b/i.exec(text)?.[1] || null
  const sourceUrl = toAbsoluteUrl(linkMatch?.[1])
  const title = normalizeWhitespace(linkMatch?.[2])
  const jobId = extractJobId(sourceUrl)

  if (!title || !sourceUrl || !jobId || !location) return null

  const beforeLocation = text.slice(0, text.indexOf(location)).trim()
  const department = beforeLocation
    .replace(title, '')
    .trim()
    .split(/\s{2,}/)[0] || null

  return {
    jobId,
    requisitionId: jobId,
    title,
    company: 'Dassault Systemes',
    department: normalizeWhitespace(department),
    location: normalizeWhitespace(location),
    city: extractCity(location),
    country: 'India',
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(type),
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Official Dassault Systemes India opening listed on the public careers page.',
    remoteStatus: null,
  }
}

const extractJobCards = (html) => [
  ...String(html ?? '').matchAll(/<(?:article|li|div)\b[^>]*(?:data-job-id|data-testid=["'][^"']*job)[^>]*>([\s\S]*?)<\/(?:article|li|div)>/gi),
].map((match) => match[0])

const hasOfficialPageShape = (html) => /Be the Next Game Changer|Search by keyword|Filter Location/i.test(html)
  || /\/careers\/jobs\/[^"'\s<]+-\d+/i.test(html)

export const extractIndiaJobs = (html) => {
  const cards = extractJobCards(html)
  const jobs = cards.map(extractCardFields).filter(Boolean)

  return [...new Map(jobs.map((job) => [job.jobId, job])).values()]
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createDassaultSystemsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)
    if (!hasOfficialPageShape(html)) {
      throw new Error('Response is not the official Dassault Systemes careers job search page')
    }

    const jobs = extractIndiaJobs(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'dassaultsystems',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createDassaultSystemsScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Dassault Systemes scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    const result = await saveToDB(jobs, 'dassaultsystems')
    console.log('DB result:', result)
    process.exit(0)
  }
}
