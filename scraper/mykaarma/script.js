import {parseNativeJSON} from './nativeJSON20261107.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MYKAARMA_CATALOG } from './catalog.js'
import { runMyKaarmaNative } from './nativeReader20261107.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MYKAARMA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_BOARD_SLUG = PROVIDER_METADATA.ripplingBoardSlug
export const RIPPLING_BOARD_URL = PROVIDER_METADATA.ripplingBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] ?? null

const parseNextData = (html) => {
  const payload = extractFirst(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    html,
  )

  if (!payload) {
    throw new Error('MyKaarma verified Rippling embed no longer exposes __NEXT_DATA__')
  }

  return parseNativeJSON(payload)
}

const getPageProps = (nextData) => nextData?.props?.pageProps ?? nextData?.pageProps ?? null

const isVerifiedBoardSlug = (value) => normalizeWhitespace(value) === JOB_BOARD_SLUG

const isIndiaLocation = (value) => /(?:^|[^a-z])(india|in)(?:[^a-z]|$)/i.test(value ?? '')

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const buildEmbedUrl = (slug = JOB_BOARD_SLUG) =>
  `https://ats.rippling.com/embed/${encodeURIComponent(slug)}/jobs?s=${encodeURIComponent(CAREERS_URL)}`

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Careers at myKaarma \| Join a Leader in Automotive Software\s*<\/title>/i.test(rawHtml)
    && /available positions/i.test(rawHtml)
    && /data-job-board-id=["']mykaarma["']/i.test(rawHtml)
    && /static-assets\.ripplingcdn\.com\/ats\/embeds\/job-board\.v1\.js/i.test(rawHtml)
}

export const extractEmbeddedJobBoard = (html) => {
  const slug = extractFirst(/data-job-board-id=["']([^"']+)["']/i, html)

  if (!isVerifiedBoardSlug(slug) || !hasVerifiedCareersPageSignal(html)) {
    throw new Error('MyKaarma verified careers page no longer exposes the expected Rippling board')
  }

  return {
    slug,
    embedUrl: buildEmbedUrl(slug),
  }
}

export const extractIndiaJobsFromEmbed = (html, { scrapedAt = new Date().toISOString() } = {}) => {
  const pageProps = getPageProps(parseNextData(html))
  const board = pageProps?.apiData?.jobBoard
  const queries = pageProps?.dehydratedState?.queries

  if (!isVerifiedBoardSlug(board?.slug) || !/mykaarma/i.test(String(board?.companyName ?? ''))) {
    throw new Error('MyKaarma verified Rippling embed no longer resolves to the expected board')
  }

  const listingsQuery = Array.isArray(queries)
    ? queries.find((query) => JSON.stringify(query?.queryKey ?? []).includes('"job-posts"'))
    : null
  const items = listingsQuery?.state?.data?.items

  if (!Array.isArray(items)) {
    throw new Error('MyKaarma verified Rippling embed no longer exposes job listings data')
  }

  return items
    .map((item) => {
      const indiaLocation = Array.isArray(item?.locations)
        ? item.locations.find((location) => (
          String(location?.countryCode ?? '').toUpperCase() === 'IN'
          || normalizeWhitespace(location?.country) === 'India'
          || isIndiaLocation(location?.name)
        ))
        : null

      if (!indiaLocation) return null

      const sourceUrl = toAbsoluteUrl(
        item?.url || `${RIPPLING_BOARD_URL}/${normalizeWhitespace(item?.id) || ''}`,
        'https://ats.rippling.com/',
      )

      if (!sourceUrl) return null

      return {
        title: normalizeWhitespace(item?.name),
        company: COMPANY,
        department: normalizeWhitespace(item?.department?.name),
        location: normalizeWhitespace(indiaLocation.name),
        city: normalizeWhitespace(indiaLocation.city),
        country: normalizeWhitespace(indiaLocation.country) || 'India',
        workplaceType: normalizeWhitespace(indiaLocation.workplaceType),
        jobId: normalizeWhitespace(item?.id),
        requisitionId: normalizeWhitespace(item?.id),
        sourceUrl,
        applyUrl: sourceUrl,
        link: sourceUrl,
        source: SOURCE,
        scrapedAt,
      }
    })
    .filter((job) => job?.title && job?.jobId && job?.location)
}

export const createMyKaarmaScraper = () => ({ run: options => runMyKaarmaNative(options) })

export const run = async (options = {}) => createMyKaarmaScraper().run(options)

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
