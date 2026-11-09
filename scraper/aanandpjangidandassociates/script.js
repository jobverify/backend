import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.ajafirm.com/career.html'
const COMPANY_NAME = 'Aanand P Jangid and Associates LLP'
const OPENINGS_URL = `${CAREER_PAGE_URL}#open-positions`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'aanandpjangidandassociates',
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const uniqueTitles = (titles) => {
  const seen = new Set()
  const unique = []

  for (const title of titles.map(normalizeWhitespace).filter(Boolean)) {
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(title)
  }

  return unique
}

const extractOpenPositionsSection = (html) =>
  String(html ?? '').match(
    /<section[^>]*\bid=["']open-positions["'][^>]*>[\s\S]*?<\/section>/i,
  )?.[0] || ''

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*AJA\s*-\s*Careers\s*<\/title>/i.test(page)
    && /\bJoin Our Team\b/i.test(normalized)
    && /\bCurrent Openings\b/i.test(normalized)
    && /\bView Open Positions\b/i.test(normalized)
    && /class=["'][^"']*\bjob-card\b/i.test(page)
    && /data-job-title=/i.test(page)
}

export const extractSearchResults = (html) => {
  const sectionHtml = extractOpenPositionsSection(html)
  const sourceHtml = sectionHtml || String(html ?? '')
  const dataTitles = [...sourceHtml.matchAll(/\bdata-job-title=["']([^"']+)["']/gi)]
    .map((match) => match[1])
  const headingTitles = [...sourceHtml.matchAll(
    /<div[^>]*class=["'][^"']*\bjob-card-header\b[^"']*["'][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/gi,
  )].map((match) => match[1])

  return uniqueTitles([...dataTitles, ...headingTitles])
    .map((title) => {
      const jobId = slugify(title)
      if (!jobId) return null

      return {
        title,
        company: COMPANY_NAME,
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: OPENINGS_URL,
        applyUrl: OPENINGS_URL,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)
}

export const createAanandPJangidAndAssociatesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialCareersSurface(careersHtml)) {
      throw new Error('AJA careers page no longer matches the verified public openings surface')
    }

    const jobs = extractSearchResults(careersHtml)
    if (jobs.length === 0) {
      throw new Error('AJA verified public openings surface no longer contains job cards')
    }

    return jobs.map((job) => ({
      ...job,
      source: 'aanandpjangidandassociates',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAanandPJangidAndAssociatesScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'aanandpjangidandassociates')
  }
}
