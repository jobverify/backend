import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SAP_CONCUR_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SAP_CONCUR_CATALOG.source
export const COMPANY = SAP_CONCUR_CATALOG.companyName
export const SAP_INDIA_JOBS_URL = SAP_CONCUR_CATALOG.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeWhitespace = (value) => decodeHtml(value)

const absoluteUrl = (value) => {
  try {
    return new URL(value, SAP_INDIA_JOBS_URL).toString()
  } catch {
    return null
  }
}

const inferCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const isConcurTitle = (title) => /\bconcur\b/i.test(String(title ?? ''))

export const hasOfficialSapIndiaListingsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Jobs in India\s*\|\s*SAP Careers\s*<\/title>/i.test(page)
    && normalized.includes('Search by keyword')
    && normalized.includes('Search by location')
    && /id="searchresults"/i.test(page)
    && /Results\s*1/i.test(normalized)
    && /Page\s*1\s*of\s*\d+/i.test(normalized)
}

export const extractSapConcurJobs = (html) => {
  if (!hasOfficialSapIndiaListingsSignal(html)) {
    throw new Error('SAP-Concur verified SAP India careers surface no longer matches the trusted listings page')
  }

  const jobs = []

  for (const match of String(html ?? '').matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = String(match[1] ?? '')
    const linkMatch = rowHtml.match(/<a\b(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>([\s\S]*?)<\/a>/i)
    const sourceUrl = absoluteUrl(linkMatch?.[1])
    const title = normalizeWhitespace(linkMatch?.[2])
    const location = normalizeWhitespace(
      rowHtml.match(/<td class="colLocation hidden-phone"[^>]*>[\s\S]*?<span class="jobLocation">\s*([\s\S]*?)<\/span>/i)?.[1]
        || rowHtml.match(/<span class="jobLocation">\s*([\s\S]*?)<\/span>/i)?.[1],
    )

    if (!sourceUrl || !title || !location) continue
    if (!isConcurTitle(title) || !/,\s*in,\s*\d{6}/i.test(location)) continue

    const jobIdMatch = sourceUrl.match(/\/(\d+)\/?$/)
    const jobId = jobIdMatch ? jobIdMatch[1] : null

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: inferCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: `Official SAP careers listing for ${title}.`,
    })
  }

  return jobs
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createSapConcurScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString() } = {}) {
    const page = await fetchPage(SAP_INDIA_JOBS_URL)
    const jobs = extractSapConcurJobs(page.html)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSapConcurScraper().run(options)

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
