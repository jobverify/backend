import path from 'path'
import { fileURLToPath } from 'url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { isIndiaJob as isIndiaJobInScope } from '../../scraper-support/utils/indiaLocationFilter.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://incture.com/careers/'
export const CAREERS_PORTAL_URL = 'https://incture.zohorecruit.com/jobs/Careers'

const COMPANY = 'Incture'
const SOURCE = 'incture'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const DETAIL_URL_REGEX = /https:\/\/incture\.zohorecruit\.com\/jobs\/Careers\/(\d+)\/[^"'<\s]+?\?source=CareerSite/gi

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '').replace(/<[^>]+>/g, ' ')

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hasInputWithId = (html, id) =>
  new RegExp(`<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, 'i').test(String(html ?? ''))

const inferCity = (location) => {
  const primaryToken = String(location ?? '').split(',')[0]?.split('/')[0]?.trim()
  return normalizeCity(primaryToken) || normalizeCity(location) || null
}

const inferCountry = (location, city) => {
  if (/india/i.test(String(location ?? ''))) return 'India'
  if (city && isIndiaJobInScope({ location, city })) return 'India'
  return null
}

const extractTitle = (blockHtml, blockText, detailUrl) => {
  const headingMatch = blockHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)
  const linkedTitleMatch = blockHtml.match(
    new RegExp(`<a\\b[^>]*href=["']${escapeRegex(detailUrl)}["'][^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
  )
  const textFallback = normalizeWhitespace(
    blockText
      ?.replace(detailUrl, ' ')
      .match(/^["'>\s-]*([^<].+?)(?=\s+(?:job\s+)?location\b|\s+apply\b|\s+job description\b|$)/i)?.[1],
  )

  for (const candidate of [headingMatch?.[1], linkedTitleMatch?.[1], textFallback]) {
    const title = normalizeWhitespace(stripTags(candidate))
    if (title && !/^apply$/i.test(title) && !/^job description$/i.test(title)) {
      return title
    }
  }

  return null
}

const extractLocation = (blockText) =>
  normalizeWhitespace(
    blockText.match(/(?:job\s+)?location\s*:?\s*(.+?)(?=\s+apply\b|\s+job description\b|$)/i)?.[1],
  )

const extractDescription = (blockText) =>
  normalizeWhitespace(
    blockText
      .match(/job description\s*:?\s*(.+)$/i)?.[1]
      ?.replace(/\s*<a href=.*$/i, ''),
  )

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /incture/i.test(page)
    && /careers/i.test(page)
    && /https:\/\/incture\.com\/careers\/?/i.test(page)
    && /https:\/\/incture\.zohorecruit\.com\/jobs\/Careers/i.test(page)
}

export const hasOfficialPortalSignal = (html) => {
  const page = String(html ?? '')

  return /incture/i.test(page)
    && /https:\/\/incture\.zohorecruit\.com\/jobs\/Careers/i.test(page)
    && hasInputWithId(page, 'pageJson')
    && hasInputWithId(page, 'moduleMeta')
    && hasInputWithId(page, 'jobs')
}

export const extractIndiaJobs = (html) => {
  const page = String(html ?? '')
  const matches = Array.from(page.matchAll(DETAIL_URL_REGEX))
  const jobEntries = []
  const seenJobIds = new Set()

  for (const match of matches) {
    const jobId = normalizeWhitespace(match[1])
    if (!jobId || seenJobIds.has(jobId)) continue

    seenJobIds.add(jobId)
    jobEntries.push({
      jobId,
      sourceUrl: match[0],
      index: match.index ?? 0,
    })
  }

  return jobEntries
    .map((entry, index) => {
      const nextIndex = jobEntries[index + 1]?.index ?? page.length
      const blockHtml = page.slice(entry.index, nextIndex)
      const blockText = normalizeWhitespace(stripTags(blockHtml))
      const title = extractTitle(blockHtml, blockText, entry.sourceUrl)
      const location = extractLocation(blockText)
      const city = inferCity(location)
      const country = inferCountry(location, city)

      if (!title || !location) return null

      const job = {
        title,
        company: COMPANY,
        department: null,
        location,
        city,
        country,
        jobId: entry.jobId,
        requisitionId: entry.jobId,
        sourceUrl: entry.sourceUrl,
        applyUrl: entry.sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: extractDescription(blockText),
      }

      return isIndiaJobInScope(job) ? job : null
    })
    .filter(Boolean)
}

export const countPortalJobRecords = (html) =>
  new Set(Array.from(String(html ?? '').matchAll(DETAIL_URL_REGEX), (match) => normalizeWhitespace(match[1])).filter(Boolean)).size

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const createInctureScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified official Incture careers page')
    }

    const portalHtml = await fetchText(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) {
      throw new Error('Response is not the verified official Incture careers portal')
    }

    const jobs = extractIndiaJobs(portalHtml)
    if (jobs.length === 0) {
      return attachInventoryEvidence([], {
        status: 'complete-inventory',
        surface: CAREERS_PORTAL_URL,
        firstParty: true,
        listingComplete: true,
        pagesFetched: 2,
        reportedTotal: countPortalJobRecords(portalHtml),
        indiaFacetCount: 0,
        verifiedAt: now(),
        reason: 'incture-official-zoho-portal-zero-india-jobs',
      })
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

export const run = async (options = {}) => createInctureScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Incture scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
