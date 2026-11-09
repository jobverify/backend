import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { INTERSOFT_DATA_LABS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = INTERSOFT_DATA_LABS_CATALOG.source
export const COMPANY = INTERSOFT_DATA_LABS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = INTERSOFT_DATA_LABS_CATALOG.officialBrandName
export const VERIFIED_ON = INTERSOFT_DATA_LABS_CATALOG.verifiedOn
export const CAREERS_URL = INTERSOFT_DATA_LABS_CATALOG.companyCareerPage
export const PROVIDER_METADATA = INTERSOFT_DATA_LABS_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
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

const stripTags = (value) => normalizeWhitespace(value)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractToggleMailto = (contentHtml) =>
  /href=["']mailto:([^"']+)["']/i.exec(String(contentHtml ?? ''))?.[1]?.trim() || null

const extractToggleLocation = (contentHtml) =>
  stripTags(/<p>\s*Location[\s-–—]*([\s\S]*?)<\/p>/i.exec(String(contentHtml ?? ''))?.[1])
    ?.replace(/^[-–—]\s*/, '')

const extractToggleBody = (contentHtml) => {
  const cleaned = String(contentHtml ?? '')
    .replace(/<p>\s*Mail Resume to[\s\S]*?<\/p>/gi, ' ')
    .replace(/<p>\s*Location[\s\S]*?<\/p>/gi, ' ')
  return stripTags(cleaned)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*-\s*Intersoft\s*<\/title>/i.test(page)
    && /Work With Us/i.test(page)
    && /Current Openings/i.test(page)
    && /Data Modeler/i.test(page)
    && /Core \.NET Dev \/ Sr\. Dev\./i.test(page)
    && /mailto:career@intsof\.com/i.test(page)
}

export const extractJobToggles = (html) => [...String(html ?? '').matchAll(
  /<div[^>]*class=["'][^"']*\bvc_toggle_title\b[^"']*["'][^>]*>\s*<h4>([\s\S]*?)<\/h4>[\s\S]*?<div[^>]*class=["'][^"']*\bvc_toggle_content\b[^"']*["'][^>]*>([\s\S]*?<p>\s*Location[\s\S]*?<\/p>)\s*<\/div>\s*<\/div>/gi,
)]
  .map((match) => {
    const title = stripTags(match[1])
    const contentHtml = match[2]
    const requiredSkills = extractListItems(contentHtml)
    const email = extractToggleMailto(contentHtml)
    const location = extractToggleLocation(contentHtml)

    if (!title || !email || !location) {
      return null
    }

    return {
      title,
      jobId: slugify(title),
      email,
      location,
      requiredSkills,
      jobDescription: extractToggleBody(contentHtml),
    }
  })
  .filter(Boolean)

const buildApplyUrl = (email, title) =>
  email ? `mailto:${email}?subject=${encodeURIComponent(`Application for ${title}`)}` : null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createIntersoftDataLabsScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
  } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const careersHtml = await fetchPageText(CAREERS_URL)

      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Intersoft Data Labs verified Intersoft careers surface no longer matches the public contract')
      }

      const openings = extractJobToggles(careersHtml)
      if (openings.length === 0) {
        throw new Error('Intersoft Data Labs verified openings surface no longer exposes the expected toggle jobs')
      }

      const jobs = openings.map((opening) => ({
        title: opening.title,
        company: COMPANY,
        department: null,
        location: opening.location,
        city: null,
        country: 'India',
        jobId: opening.jobId,
        requisitionId: opening.jobId,
        sourceUrl: `${CAREERS_URL}#${opening.jobId}`,
        applyUrl: buildApplyUrl(opening.email, opening.title),
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: opening.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: opening.jobDescription,
        remoteStatus: null,
        source: SOURCE,
        link: buildApplyUrl(opening.email, opening.title),
        scrapedAt: now(),
      }))

      return maxJobs ? jobs.slice(0, maxJobs) : jobs
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createIntersoftDataLabsScraper(options).run(options)

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
