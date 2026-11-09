import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FRONTEGG_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FRONTEGG_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_JOB_DETAIL_URL = PROVIDER_METADATA.verifiedJobDetailUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value = '') =>
  String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value = '') =>
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const stripTags = (value = '') =>
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers at Frontegg(?:\s*\|\s*Open Roles in Identity\s*(?:&|&amp;)\s*AI Security)?\s*<\/title>/i.test(page)
    && /Careers at Frontegg/i.test(text)
    && /Current openings/i.test(text)
    && (
      (
        /Senior Backend Developer/i.test(text)
        && /Technical Support - Tier 2 Support/i.test(text)
        && /Apply now/i.test(text)
      )
      || /We don't have any open positions at this time\.\s*Please visit again soon\./i.test(text)
    )
}

const extractListingCards = (html = '') => {
  const cards = []

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']*\/careers\/co\/[^"']+\/all)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (!absoluteUrl) continue

    cards.push({
      url: absoluteUrl,
      label: stripTags(match[2]),
    })
  }

  return cards
}

export const extractListingLinks = (html = '') =>
  [...new Set(extractListingCards(html).map((card) => card.url))]

const extractHeadingText = (html = '', pattern) => {
  const match = String(html ?? '').match(pattern)
  return stripTags(match?.[1] ?? '')
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Job opportunity:/i.test(page)
    && text.includes('About The Position')
    && text.includes('Apply for this position')
    && text.includes('All Jobs')
}

const htmlSectionToText = (html = '') =>
  decodeHtmlEntities(String(html ?? ''))
    .replace(/<li[^>]*>\s*/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<h[1-6][^>]*>\s*/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '')
    .replace(/<p[^>]*>\s*/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>|<div[^>]*>|<\/div>|<section[^>]*>|<\/section>|<main[^>]*>|<\/main>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

export const parseJobDetail = (html = '', jobUrl = '') => {
  const title = extractHeadingText(html, /<h[1-3][^>]*>\s*(.*?)\s*<\/h[1-3]>/i)
  const location = extractHeadingText(
    html,
    /<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>\s*<p[^>]*>\s*(.*?)\s*<\/p>/i,
  )
  const descriptionMatch = String(html ?? '').match(
    /(<h[1-6][^>]*>\s*About The Position\s*<\/h[1-6]>[\s\S]*?)<h[1-6][^>]*>\s*Apply for this position\s*<\/h[1-6]>/i,
  )

  if (!title || !location || !descriptionMatch) {
    throw new Error(`Frontegg job detail page no longer matches the verified public surface: ${jobUrl}`)
  }

  return {
    title,
    location,
    jobDescription: htmlSectionToText(descriptionMatch[1]),
  }
}

const inferEmploymentType = (label = '') => {
  const match = String(label ?? '').match(/\b(Full-time|Part-time|Contract|Internship)\b/i)
  return match ? match[1].replace(/^./, (value) => value.toUpperCase()) : null
}

const inferDepartment = ({ label = '', title = '', employmentType = null }) => {
  let normalized = stripTags(label)
  if (!normalized) return null

  normalized = normalized.replace(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
  normalized = normalized.replace(/\bApply now\b/i, '')

  if (employmentType) {
    normalized = normalized.replace(new RegExp(employmentType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
  }

  normalized = normalized.replace(/\s+/g, ' ').trim()
  return normalized || null
}

const extractJobIdFromUrl = (url = '') => {
  const match = String(url ?? '').match(/\/careers\/co\/[^/]+\/([^/]+)\//i)
  return match?.[1] ?? null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFronteggScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Frontegg careers page no longer matches the verified public surface')
    }

    const listingCards = extractListingCards(careersHtml)
    const uniqueCards = [...new Map(listingCards.map((card) => [card.url, card])).values()]

    if (uniqueCards.length === 0) {
      if (/We don't have any open positions at this time\.\s*Please visit again soon\./i.test(normalizeWhitespace(careersHtml))) {
        return []
      }
      throw new Error('Frontegg careers page no longer exposes verified current opening links')
    }

    const jobs = []

    for (const card of uniqueCards) {
      const detailHtml = await fetchText(card.url)

      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`Frontegg job detail page no longer matches the verified public surface: ${card.url}`)
      }

      const detail = parseJobDetail(detailHtml, card.url)
      const employmentType = inferEmploymentType(card.label)

      jobs.push({
        title: detail.title,
        location: detail.location,
        country: PROVIDER_METADATA.countryFilter,
        company: COMPANY,
        source: SOURCE,
        sourceUrl: card.url,
        applyUrl: card.url,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        jobId: extractJobIdFromUrl(card.url),
        department: inferDepartment({
          label: card.label,
          title: detail.title,
          employmentType,
        }),
        employmentType,
        jobDescription: detail.jobDescription,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createFronteggScraper().run(options)

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
