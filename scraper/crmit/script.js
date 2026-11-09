import path from 'path'
import { fileURLToPath } from 'url'

export const CAREER_PAGE_URL = 'https://www.crmit.com/careers/job-search.html'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toOfficialUrl = (value) => {
  try {
    const url = new URL(value, CAREER_PAGE_URL)
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

const extractField = (card, className) => normalizeWhitespace(
  card.match(new RegExp(`<[^>]+class="[^"]*\\b${className}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/div>`, 'i'))?.[0],
)

const extractJobCards = (html) => [...String(html ?? '').matchAll(
  /<section\b(?=[^>]*\bjob-listing\b)[^>]*>([\s\S]*?)<\/section>/gi,
)].map((match) => match[1])

export const extractOpenings = (html) => extractJobCards(html)
  .filter((card) => /\bapply\s+now\b/i.test(card) && !/\bposition\s+closed\b/i.test(card))
  .map((card) => {
    const titleMatch = card.match(/<div[^>]+class="[^"]*\bjobTitle\b[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    const title = normalizeWhitespace(titleMatch?.[2])
    const location = extractField(card, 'location')
    const experienceRequired = extractField(card, 'experience')
    const applyUrl = toOfficialUrl(titleMatch?.[1])

    if (!title || !location || !applyUrl || !/\bindia\b/i.test(location)) return null

    const city = normalizeWhitespace(location.split(',')[0])
    const jobId = `crmit-${slugify(title)}`

    return {
      title,
      company: 'CRMIT Solutions',
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREER_PAGE_URL,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `Apply for ${title} through the CRMIT Solutions careers page.`,
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createCrmitScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const jobs = extractOpenings(await fetchText(CAREER_PAGE_URL))

    return jobs.map((job) => ({
      ...job,
      source: 'crmit',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCrmitScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'crmit')
  }
}
