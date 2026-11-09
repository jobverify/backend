import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { CDW_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CDW_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const SEARCH_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_SEARCH_URL = new URL('/search/jobs/in/country/india', SEARCH_URL).toString()

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value = '') => {
  try {
    return new URL(value, SEARCH_URL).toString()
  } catch {
    return null
  }
}

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

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

export const hasBlockedSearchSurfaceSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Just a moment...')
    && normalized.includes('Enable JavaScript and cookies to continue')
}

const isTrustedBlockedPage = (page = {}, expectedUrl) => {
  const status = Number(page.status)
  const finalUrl = String(page.url || expectedUrl)

  return (status === 403 || status === 429)
    && finalUrl === expectedUrl
    && hasBlockedSearchSurfaceSignal(getPageHtml(page))
}

const HAS_JOB_DETAIL_LINK_PATTERN = /href=["'][^"']*(?:\/jobs\/|\/search\/jobs\/)[^"']+/i

export const hasOfficialSearchResultsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const page = String(html ?? '')
  return normalized.includes('Job Search Results')
    && /\bIndia\s*\(\d+\s*jobs?\s*\)/i.test(normalized)
    && Boolean(
      extractIndiaSearchUrl(page)
      || (
        /(jobs-section__item|<article)/i.test(page)
        && HAS_JOB_DETAIL_LINK_PATTERN.test(page)
      )
    )
}

const extractLegacyListingCards = (html = '') =>
  [...String(html).matchAll(/<article[^>]*>([\s\S]*?)<\/article>/gi)]
    .map((match) => match[1])
    .map((block) => {
      const lines = [...block.matchAll(/<(?:h4|p)[^>]*>\s*([\s\S]*?)\s*<\/(?:h4|p)>/gi)]
        .map((match) => normalizeWhitespace(match[1]))
        .filter(Boolean)
      const title = normalizeWhitespace(block.match(/<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i)?.[1] || '')
      const detailUrl = toAbsoluteUrl(block.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] || '')

      return {
        title,
        detailUrl,
        focusArea: lines[1] || null,
        location: lines[2] || null,
      }
    })

const extractCurrentListingCards = (html = '') =>
  [...String(html).matchAll(
    /<div[^>]*class=["'][^"']*jobs-section__item[^"']*["'][^>]*>[\s\S]*?<h4[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h4>[\s\S]*?<div[^>]*class=["'][^"']*columns medium-7[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<div[^>]*class=["'][^"']*columns medium-5 text-right[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[2]),
      detailUrl: toAbsoluteUrl(match[1]),
      focusArea: normalizeWhitespace(match[3]) || null,
      location: normalizeWhitespace(match[4]) || null,
    }))

export const extractListingCards = (html = '') => {
  const legacyListings = extractLegacyListingCards(html)
  const listings = legacyListings.length > 0
    ? legacyListings
    : extractCurrentListingCards(html)

  return listings.filter((job) => job.title && job.detailUrl && /, India$/i.test(job.location || ''))
}

export const extractIndiaSearchUrl = (html = '') => {
  const href = String(html ?? '').match(
    /<a[^>]+href=["']([^"']*\/search\/jobs\/in\/country\/india[^"']*)["'][^>]*>/i,
  )?.[1]

  return href ? toAbsoluteUrl(href) : null
}

export const hasOfficialIndiaResultsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const page = String(html ?? '')

  return (
    (normalized.includes('India Careers') || normalized.includes('Job Search Results'))
    && /\bCountry\s+India\s*\(\d+\s*jobs?\s*\)/i.test(normalized)
    && /(jobs-section__item|<article)/i.test(page)
    && HAS_JOB_DETAIL_LINK_PATTERN.test(page)
  )
}

const resolveIndiaSearchUrl = (searchHtml = '') => {
  const explicitIndiaUrl = extractIndiaSearchUrl(searchHtml)
  if (explicitIndiaUrl) return explicitIndiaUrl
  if (extractListingCards(searchHtml).length > 0) return SEARCH_URL
  return INDIA_SEARCH_URL
}

const extractField = (html = '', label = '') => {
  const normalized = normalizeWhitespace(html)
  const pattern = new RegExp(`${label}:\\s*([^:]+?)(?=\\s+(?:Job ID|Team|Focus Area|Location|Remote Type|Date Posted|Description|Key Responsibility|Other Responsibilities|Education and/or Experience Qualifications|Required Qualifications|Preferred Qualifications|About Us|Apply Now)\\b|$)`, 'i')
  return normalizeWhitespace(normalized.match(pattern)?.[1] || '')
}

const extractDescription = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const match = normalized.match(/Description\s+([\s\S]*?)(?=\s+(?:Key Responsibility|Other Responsibilities|Education and\/or Experience Qualifications|Required Qualifications|Preferred Qualifications|About Us|Apply Now)\b|$)/i)
  return normalizeWhitespace(match?.[1] || '')
}

const extractDetail = (html = '') => ({
  title: normalizeWhitespace(html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1] || ''),
  jobId: extractField(html, 'Job ID'),
  team: extractField(html, 'Team'),
  focusArea: extractField(html, 'Focus Area'),
  location: extractField(html, 'Location'),
  remoteType: extractField(html, 'Remote Type'),
  datePosted: extractField(html, 'Date Posted'),
  jobDescription: extractDescription(html),
})

export const createCdwScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage, fetchText, fetchBrowserText } = {}) {
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

    const loadPage = async (url) => {
      if (typeof fetchPage === 'function') {
        return fetchPage(url)
      }

      if (typeof fetchText === 'function') {
        try {
          return {
            status: 200,
            url,
            html: await fetchText(url),
          }
        } catch (error) {
          if (!(typeof fetchBrowserText === 'function' || fetchBrowserText === undefined) || !isBrowserFallbackError(error)) {
            throw error
          }

          return {
            status: 200,
            url,
            html: await browserTextFetcher(url),
          }
        }
      }

      return defaultFetchPage(url)
    }

    try {
      const searchPage = await loadPage(SEARCH_URL)
      const searchHtml = getPageHtml(searchPage)

      let indiaSearchUrl = INDIA_SEARCH_URL
      let indiaSearchPage = null
      let indiaSearchHtml = ''

      if (isTrustedBlockedPage(searchPage, SEARCH_URL)) {
        indiaSearchPage = await loadPage(INDIA_SEARCH_URL)
        indiaSearchHtml = getPageHtml(indiaSearchPage)

        if (isTrustedBlockedPage(indiaSearchPage, INDIA_SEARCH_URL)) {
          return []
        }
      } else {
        if (!hasOfficialSearchResultsSignal(searchHtml)) {
          throw new Error('CDW search results page no longer matches the verified first-party surface')
        }

        indiaSearchUrl = resolveIndiaSearchUrl(searchHtml)
        indiaSearchPage = indiaSearchUrl === SEARCH_URL
          ? searchPage
          : await loadPage(indiaSearchUrl)
        indiaSearchHtml = getPageHtml(indiaSearchPage)

        if (indiaSearchUrl !== SEARCH_URL && isTrustedBlockedPage(indiaSearchPage, indiaSearchUrl)) {
          return []
        }
      }

      if (!hasOfficialIndiaResultsSignal(indiaSearchHtml)) {
        throw new Error('CDW India results page no longer matches the verified first-party jobs surface')
      }

      const listings = extractListingCards(indiaSearchHtml)
      if (listings.length === 0) {
        throw new Error('CDW search results no longer expose trusted India listings')
      }

      const jobs = []
      for (const listing of listings) {
        const detailHtml = getPageHtml(await loadPage(listing.detailUrl))
        const detail = extractDetail(detailHtml)
        const location = detail.location || listing.location
        if (!/, India$/i.test(location || '')) continue
        const title = detail.title || listing.title
        const city = normalizeCity(location.split(',')[0]?.trim() || location)
        const jobId = detail.jobId || toSlug(title)

        jobs.push({
          title,
          company: COMPANY,
          location,
          city,
          country: 'India',
          team: detail.team || null,
          department: detail.focusArea || listing.focusArea || null,
          focusArea: detail.focusArea || listing.focusArea || null,
          remoteType: detail.remoteType || null,
          employmentType: null,
          jobId,
          requisitionId: jobId,
          datePosted: detail.datePosted || null,
          sourceUrl: listing.detailUrl,
          applyUrl: listing.detailUrl,
          link: listing.detailUrl,
          jobDescription: detail.jobDescription || null,
          source: SOURCE,
          scrapedAt: now(),
        })
      }

      return jobs.sort((left, right) => left.title.localeCompare(right.title))
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createCdwScraper(options).run(options)

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
