import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import INDEED_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INDEED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_CAREERS_URL = PROVIDER_METADATA.indiaCareersPage
export const INDIA_JOBS_URL = PROVIDER_METADATA.indiaJobsPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractHref = (block) =>
  String(block ?? '').match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? null

const extractLines = (block) =>
  [...String(block ?? '').matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const extractIndiaJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], INDIA_CAREERS_URL)
    if (absoluteUrl === INDIA_JOBS_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<h1>\s*We help people get jobs\.\s*<\/h1>/i.test(rawHtml)
    && /Opportunities around the globe/i.test(normalized)
    && /Choose a location to search for open roles at Indeed\./i.test(normalized)
    && extractIndiaCareersUrl(rawHtml) === INDIA_CAREERS_URL
}

export const extractIndiaCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl === INDIA_CAREERS_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasIndiaJobsSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Indeed Jobs and Careers \| Indeed\.com\s*<\/title>/i.test(rawHtml)
    && /<h1>\s*Indeed Jobs\s*<\/h1>/i.test(rawHtml)
    && /\bjobs at Indeed\b/i.test(normalized)
    && /data-jobkey=/i.test(rawHtml)
  }

export const pageIndicatesCloudflareChallenge = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(rawHtml)
    || /Additional Verification Required/i.test(normalized)
    || /PAGE_TYPE\s*:\s*["']captcha["']/i.test(rawHtml)
    || /Cloudflare Ray ID/i.test(normalized)
  }

export const extractPublicJobsFromIndiaJobsPage = (html, { scrapedAt } = {}) =>
  [...String(html ?? '').matchAll(/<li\b[^>]*data-jobkey=["']([^"']+)["'][^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => {
      const jobId = match[1]
      const block = match[2]
      const title = normalizeWhitespace(
        block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i)?.[1] ?? null,
      )
      const href = extractHref(block)
      const lines = extractLines(block)
      const locationText = lines[0] ?? null
      const compensation = lines.find((line) => /year|month|hour|day|week|₹|â‚¹/i.test(line)) ?? null
      const employmentType = lines.find((line) => /full-?time|part-?time|contract|internship/i.test(line)) ?? null
      const remote = /remote/i.test(locationText ?? '')
      const city = remote ? null : normalizeWhitespace(locationText?.split(',')[0] ?? null)
      const location = remote
        ? 'Remote, India'
        : [locationText, 'India']
          .filter(Boolean)
          .join(locationText?.includes('India') ? '' : ', ')
      const jobUrl = toAbsoluteUrl(href, INDIA_JOBS_URL)

      if (!title || !jobUrl || !location) return null

      return {
        title,
        company: COMPANY,
        location,
        city,
        country: 'India',
        jobId,
        requisitionId: null,
        sourceUrl: jobUrl,
        applyUrl: jobUrl,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: remote ? 'Remote' : 'On-site',
        compensation,
        source: SOURCE,
        link: jobUrl,
        scrapedAt: scrapedAt ?? new Date().toISOString(),
      }
    })
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const getPageHtml = (page = {}) => String(page.html ?? page.text ?? page.body ?? '')

export const createIndeedScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchPage,
    fetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const effectiveFetchPage = fetchPage || (fetchText
      ? async (url) => ({
        status: 200,
        url,
        html: await fetchText(url),
      })
      : defaultFetchPage)

    const careersPage = await effectiveFetchPage(CAREERS_URL)
    const careersHtml = getPageHtml(careersPage)
    if (pageIndicatesCloudflareChallenge(careersHtml)) {
      return []
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Indeed verified careers handoff changed materially')
    }

    if (extractIndiaCareersUrl(careersHtml) !== INDIA_CAREERS_URL) {
      throw new Error('Indeed verified careers handoff changed materially')
    }

    const indiaCareersPage = await effectiveFetchPage(INDIA_CAREERS_URL)
    const indiaCareersHtml = getPageHtml(indiaCareersPage)
    if (pageIndicatesCloudflareChallenge(indiaCareersHtml)) {
      return []
    }

    const verifiedJobsUrl = hasIndiaJobsSignal(indiaCareersHtml)
      ? INDIA_JOBS_URL
      : extractIndiaJobsUrl(indiaCareersHtml)

    if (verifiedJobsUrl !== INDIA_JOBS_URL) {
      throw new Error('Indeed verified careers handoff changed materially')
    }

    const indiaJobsHtml = hasIndiaJobsSignal(indiaCareersHtml)
      ? indiaCareersHtml
      : getPageHtml(await effectiveFetchPage(INDIA_JOBS_URL))

    if (pageIndicatesCloudflareChallenge(indiaJobsHtml)) {
      return []
    }

    if (!hasIndiaJobsSignal(indiaJobsHtml)) {
      throw new Error('Indeed verified india jobs page changed materially')
    }

    const jobs = extractPublicJobsFromIndiaJobsPage(indiaJobsHtml, {
      scrapedAt: now(),
    })

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createIndeedScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
