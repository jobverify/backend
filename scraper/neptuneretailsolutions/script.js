import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neptuneretailsolutions'
export const COMPANY = 'Neptune Retail Solutions'
export const VERIFIED_ON = '2026-08-03'
export const LEGACY_QUOTIENT_URL = 'https://www.quotient.com/'
export const HOMEPAGE_URL = 'https://neptuneretailsolutions.com/'
export const ABOUT_URL = 'https://neptuneretailsolutions.com/about-us/'
export const FIELD_JOBS_HANDOFF_URL = 'https://neptuneretailsolutions.pinpointhq.com/'
export const FIELD_JOBS_URL = 'https://neptuneretailsolutions.pinpointhq.com/jobs'
export const FIELD_JOBS_RSS_URL = 'https://neptuneretailsolutions.pinpointhq.com/jobs.rss'
export const CORPORATE_JOBS_URL = 'https://neptuneretailsolutions.bamboohr.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) =>
  decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeUrl = (value, baseUrl = FIELD_JOBS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return normalized
  }
}

const extractTagValue = (xml, tagName) =>
  String(xml ?? '').match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'))?.[1] ?? null

const toIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const isNeptuneHomepageUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'neptuneretailsolutions.com' || hostname === 'www.neptuneretailsolutions.com'
  } catch {
    return false
  }
}

const isPinpointJobUrl = (value) => {
  try {
    return new URL(value || FIELD_JOBS_URL).hostname.toLowerCase() === 'neptuneretailsolutions.pinpointhq.com'
  } catch {
    return false
  }
}

const isPinpointCareerSurfaceUrl = (value) => {
  try {
    const parsed = new URL(value || FIELD_JOBS_HANDOFF_URL)
    if (parsed.hostname.toLowerCase() !== 'neptuneretailsolutions.pinpointhq.com') {
      return false
    }

    const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    return pathname === '/' || pathname === '/jobs'
  } catch {
    return false
  }
}

export const hasOfficialNeptuneHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('neptune retail solutions')
    && normalized.includes('the only marketing solution connecting consumers through every step of their shopping journey')
    && normalized.includes('harness the unparalleled power of neptune')
}

export const hasOfficialAboutUsSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('acquire quotient creating the market leading in-store media network linked to market leading digital incentives network')
    && normalized.includes('join neptune')
    && normalized.includes('browse field positions')
    && normalized.includes('browse corporate positions')
}

export const aboutPageLinksToOfficialJobSurfaces = (html) => {
  const links = [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => normalizeUrl(match[1], ABOUT_URL))
    .filter(Boolean)

  return links.some((url) => isPinpointCareerSurfaceUrl(url))
    && links.includes(CORPORATE_JOBS_URL)
}

export const extractFieldFeedItems = (feedXml) =>
  [...String(feedXml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(([, itemXml]) => {
      const title = normalizeWhitespace(extractTagValue(itemXml, 'title'))
      const sourceUrl = normalizeUrl(extractTagValue(itemXml, 'link'))
      const jobDescription = normalizeWhitespace(extractTagValue(itemXml, 'description'))
      const postingDate = toIsoDate(extractTagValue(itemXml, 'pubDate'))

      if (!title || !sourceUrl || !isPinpointJobUrl(sourceUrl)) {
        return null
      }

      const pathname = (() => {
        try {
          return new URL(sourceUrl).pathname
        } catch {
          return ''
        }
      })()
      const jobId = pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || sourceUrl

      return {
        jobId,
        requisitionId: jobId,
        title,
        company: COMPANY,
        department: null,
        location: null,
        city: null,
        country: null,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate,
        closingDate: null,
        jobDescription,
        sourceUrl,
        applyUrl: sourceUrl,
      }
    })
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNeptuneRetailSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchText = defaultFetchText } = {}) {
    const legacyHomepage = await fetchPage(LEGACY_QUOTIENT_URL)

    if (
      legacyHomepage.status !== 200
      || !isNeptuneHomepageUrl(legacyHomepage.url)
      || !hasOfficialNeptuneHomepageSignal(legacyHomepage.html)
    ) {
      throw new Error('Quotient legacy homepage no longer resolves to the verified Neptune Retail Solutions public surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)

    if (
      aboutPage.status !== 200
      || !hasOfficialAboutUsSignal(aboutPage.html)
      || !aboutPageLinksToOfficialJobSurfaces(aboutPage.html)
    ) {
      throw new Error('Neptune About Us page no longer matches the verified careers handoff surface')
    }

    const feedXml = await fetchText(FIELD_JOBS_RSS_URL)
    const listings = extractFieldFeedItems(feedXml)

    return listings.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createNeptuneRetailSolutionsScraper().run(options)

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
