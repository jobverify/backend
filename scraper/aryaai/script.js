import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createCurrentAryaAiScraper} from './currentNative.js'

import { ARYAAI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ARYAAI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const CHECKED_MISSING_ROUTE_URLS = [...PROVIDER_METADATA.checkedMissingRouteUrls]
export const VERIFIED_APPLY_URLS = [...PROVIDER_METADATA.verifiedApplyUrls]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const isWellfoundJobUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.hostname === 'wellfound.com' && /^\/jobs\/[0-9]+-[a-z0-9-]+$/i.test(url.pathname)
  } catch {
    return false
  }
}

export const extractCareersUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (absoluteUrl && sameUrl(absoluteUrl, CAREERS_URL)) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml)?.toLowerCase() || ''
  const title = (extractTitle(rawHtml) || '').toLowerCase()

  return rawHtml.includes('data-wf-domain="arya.ai"')
    && title.includes('arya.ai')
    && title.includes('enterprise-grade ai solutions')
    && normalized.includes('enterprise-grade ai solutions')
    && normalized.includes('autonomous finance')
}

export const extractJobIdFromApplyUrl = (value) => {
  try {
    const pathname = new URL(String(value ?? '')).pathname
    const match = pathname.match(/^\/jobs\/([^/?#]+)/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export const extractJobCards = (html = '') =>
  String(html ?? '')
    .split('<div class="car_item">')
    .slice(1)
    .map((chunk) => {
      const title = normalizeWhitespace(chunk.match(/<h3 class="car_h3">([\s\S]*?)<\/h3>/i)?.[1])
      const departmentMatches = [...chunk.matchAll(/fs-cmsfilter-field="dept">([\s\S]*?)<\/div>/gi)]
        .map((match) => normalizeWhitespace(match[1]))
        .filter(Boolean)
      const department = departmentMatches.find((value) => !/^view all$/i.test(value)) || null
      const locationMatches = [...chunk.matchAll(/<div class="car_dept"><div([^>]*)>([^<]+)<\/div><\/div>/gi)]
        .map((match) => ({
          attributes: match[1] || '',
          value: normalizeWhitespace(match[2]),
        }))
        .filter(({ value }) => value)
      const location = locationMatches.find(({ attributes }) => !attributes.includes('fs-cmsfilter-field'))?.value || null
      const applyUrl = normalizeWhitespace(
        chunk.match(/<a href="([^"]+)" class="ar-button[^"]*">Apply now<\/a>/i)?.[1],
      )
      const jobDescription = normalizeWhitespace(
        chunk.match(
          /<a href="[^"]+" class="ar-button[^"]*">Apply now<\/a>\s*<\/div>\s*<div>([\s\S]*?)<\/div>\s*<\/div>\s*<div><\/div>\s*<div class="car_contract">/i,
        )?.[1],
      )
      const employmentType = normalizeWhitespace(
        chunk.match(/<div class="car_contract">[\s\S]*?<div>([^<]+)<\/div>/i)?.[1],
      )
      const jobId = extractJobIdFromApplyUrl(applyUrl)

      if (!title || !department || !location || !employmentType || !jobDescription || !jobId || !isWellfoundJobUrl(applyUrl)) {
        return null
      }

      return {
        title,
        department,
        location,
        employmentType,
        applyUrl,
        jobId,
        requisitionId: jobId,
        jobDescription,
      }
    })
    .filter(Boolean)

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = stripTags(rawHtml)?.toLowerCase() || ''
  const title = (extractTitle(rawHtml) || '').toLowerCase()

  return rawHtml.includes('data-wf-domain="arya.ai"')
    && title.includes('careers at arya.ai')
    && title.includes('shape the future of enterprise ai')
    && normalized.includes('shape the future of enterprise ai')
    && normalized.includes('open positions')
    && rawHtml.includes('fs-cmsfilter-element="list"')
    && rawHtml.includes('car_col-wrap w-dyn-list')
    && extractJobCards(rawHtml).length > 0
}

export const hasSitemapCareersSignal = (sitemapXml = '') =>
  /https:\/\/arya\.ai\/careers(?:\/|<|\?|#|$)/i.test(String(sitemapXml ?? ''))

export const isMissingCareersRoute = (page = {}) => {
  const rawUrl = String(page.url || '')
  let isOfficialDomain = false

  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase()
    isOfficialDomain = hostname === 'arya.ai' || hostname === 'www.arya.ai'
  } catch {
    isOfficialDomain = false
  }

  return Number(page.status) === 404
    && isOfficialDomain
    && extractTitle(page.html) === 'Not Found'
  }

export const createAryaAiScraper = createCurrentAryaAiScraper

export const run = async (options = {}) => createAryaAiScraper(options).run(options)

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
