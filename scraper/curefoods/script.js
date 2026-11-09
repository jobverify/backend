import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'curefoods'
export const COMPANY = 'Curefoods'
export const CAREERS_URL = 'https://www.curefoods.in/pages/careers'
export const APPLICATION_EMAIL = 'careers@curefoods.in'
export const VERIFIED_LINKEDIN_URL = 'https://www.linkedin.com/company/curefoods/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizeLinkedInJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    if (!/(?:^|\.)linkedin\.com$/i.test(hostname)) return null

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInJobsUrl(redirected) : null
    }

    if (/^\/company\/curefoods(?:\/jobs)?\/?$/i.test(url.pathname)) {
      const normalized = new URL('https://www.linkedin.com/company/curefoods/')
      return normalized.toString()
    }
  } catch {
    return null
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/(?:www\.)?curefoods\.in\/(?:pages\/)?careers["']/i.test(page)
  const hasCurrentNextPage = /<title[^>]*>\s*Careers\s*-\s*Curefoods\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Career opportunities at Curefoods["']/i.test(page)
    && /Careers at Curefoods/i.test(text)

  return (hasCanonical || hasCurrentNextPage)
    && /Careers/i.test(text)
    && /Curefoods/i.test(text)
    && text.includes(APPLICATION_EMAIL)
    && /linkedin/i.test(page)
}

export const extractLinkedInJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const linkedInUrl = normalizeLinkedInJobsUrl(match[1])
    if (linkedInUrl) return linkedInUrl
  }

  return null
}

export const pageExposesFirstPartyJobRecords = (html) => {
  const page = String(html ?? '')

  for (const match of page.matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl) continue

    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'curefoods.in') continue
    if (/\/(jobs?|openings?)(\/|$)/i.test(url.pathname)) return true
  }

  return /"@type"\s*:\s*"JobPosting"/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCurefoodsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Curefoods careers surface changed or disappeared')
    }

    if (extractLinkedInJobsUrl(careersHtml) !== VERIFIED_LINKEDIN_URL) {
      throw new Error('Curefoods careers page no longer links to the verified LinkedIn handoff')
    }

    if (pageExposesFirstPartyJobRecords(careersHtml)) {
      throw new Error('Curefoods first-party public job records now appear on the verified careers page')
    }

    return []
  },
})

export const run = async (options = {}) => createCurefoodsScraper().run(options)

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
