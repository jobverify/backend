import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intelligencebureau'
export const COMPANY = 'Intelligence Bureau'
export const VACANCIES_PAGE_URL = 'https://www.mha.gov.in/en/notifications/vacancies'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const IB_TITLE_PATTERN =
  /\b(intelligence bureau|assistant central intelligence officer|acio|security assistant|junior intelligence officer)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (href, baseUrl = VACANCIES_PAGE_URL) => {
  try {
    return new URL(href, baseUrl).toString().replace(/^http:/i, 'https:')
  } catch {
    return null
  }
}

export const hasOfficialVacanciesSignal = (html) => {
  const page = normalizeWhitespace(html)

  return page.includes('Ministry of Home Affairs')
    && page.includes('Vacancies')
    && page.includes('SR-No Keyword Download/Link')
}

export const extractPageUrls = (html) => [...new Set(
  [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']*\?page=\d+)["'][^>]*>/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean),
)]

const extractRowCells = (rowHtml) => [...String(rowHtml ?? '').matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
  .map((match) => match[1])

const extractDownloadUrl = (rowHtml) => {
  const match = String(rowHtml ?? '').match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Download\b/i)
  return match ? toAbsoluteUrl(match[1]) : null
}

export const extractOpenings = (html, sourceUrl = VACANCIES_PAGE_URL) => {
  if (!hasOfficialVacanciesSignal(html)) return []

  return [...String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const rowHtml = match[1]
      const cells = extractRowCells(rowHtml)
      const serial = normalizeWhitespace(cells[0])
      const title = stripTags(cells[1])
      const applyUrl = extractDownloadUrl(rowHtml)

      if (!serial || !title || !applyUrl || !IB_TITLE_PATTERN.test(title)) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        state: null,
        country: 'India',
        jobId: `${SOURCE}-${slugify(`${serial}-${title}`)}`,
        requisitionId: serial,
        sourceUrl,
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Official Intelligence Bureau vacancy notice hosted on the Ministry of Home Affairs vacancies page. Review the government posting for eligibility and application details.',
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIntelligenceBureauScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const pendingUrls = [VACANCIES_PAGE_URL]
    const visitedUrls = new Set()
    const jobsById = new Map()

    while (pendingUrls.length > 0) {
      const url = pendingUrls.shift()
      if (visitedUrls.has(url)) continue
      visitedUrls.add(url)

      const html = await fetchText(url)
      if (!hasOfficialVacanciesSignal(html)) {
        throw new Error('Intelligence Bureau official MHA vacancies surface changed')
      }

      extractOpenings(html, url).forEach((job) => jobsById.set(job.jobId, job))
      extractPageUrls(html).forEach((pageUrl) => {
        if (!visitedUrls.has(pageUrl)) pendingUrls.push(pageUrl)
      })
    }

    return [...jobsById.values()].map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createIntelligenceBureauScraper().run(options)

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
