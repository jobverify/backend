import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SAAMA_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const DETAIL_URL_PATTERN = 'https://jobs.jobvite.com/saama/job/{jobvite_id}'
export const APPLY_URL_PATTERN = 'https://jobs.jobvite.com/saama/job/{jobvite_id}/apply'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n+/g, '\n')
  .trim()

const normalizeText = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    const normalized = normalizeText(match?.[1])
    if (normalized) return normalized
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = JOB_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const buildDetailUrl = (jobId) => DETAIL_URL_PATTERN.replace('{jobvite_id}', jobId)
const buildApplyUrl = (jobId) => APPLY_URL_PATTERN.replace('{jobvite_id}', jobId)

const extractRequiredSkills = (html) =>
  [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)

const extractExperienceRequired = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(/\b\d+\+?\s*years\b/i)
  return match ? match[0].replace(/\s+/g, ' ') : null
}

const extractJsonLdValue = (html, key) =>
  normalizeText(String(html ?? '').match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'))?.[1] ?? null)

const normalizeLocation = ({ city, state, country, fallback }) => {
  const normalizedCountry = normalizeText(country || fallback?.country || null)
  if (!normalizedCountry) return null

  const normalizedCity = normalizeText(city || fallback?.city || null)
  const normalizedState = normalizeText(state || fallback?.state || null)
  const normalizedFallbackLocation = normalizeText(fallback?.location || null)

  if (normalizedCity || normalizedState) {
    return [normalizedCity, normalizedState, normalizedCountry].filter(Boolean).join(', ')
  }

  if (normalizedFallbackLocation && /india$/i.test(normalizedFallbackLocation)) {
    return normalizedFallbackLocation
  }

  return [normalizedCity, normalizedCountry].filter(Boolean).join(', ') || null
}

const parseLocationParts = (location) => {
  const normalizedLocation = normalizeText(location)
  if (!normalizedLocation) return {}

  const parts = normalizedLocation.split(',').map((part) => part.trim()).filter(Boolean)
  return {
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts[parts.length - 1] || null,
  }
}

const isIndiaCountry = (value) => /india/i.test(String(value ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\b[^<]*Saama/i.test(page)
    && /Explore our openings/i.test(text)
    && (
      extractJobBoardUrl(page) === JOB_BOARD_URL
      || /data-careersite=["']saama["']/i.test(page)
      || /Jobvite\s*=\s*\{\s*careersite:\s*['"]saama['"]\s*\}/i.test(page)
      || /jobs\.jobvite\.com\/__assets__\/scripts\/careersite\/public\/iframe\.js/i.test(page)
    )
}

export const extractJobBoardUrl = (html = '') => {
  const raw = firstMatch(html, [
    /href=["'](https:\/\/jobs\.jobvite\.com\/saama\/?)["']/i,
    /href=["'](https:\/\/jobs\.jobvite\.com\/careers\/saama\/search)["']/i,
  ])

  if (!raw) {
    return /data-careersite=["']saama["']/i.test(String(html ?? ''))
      || /Jobvite\s*=\s*\{\s*careersite:\s*['"]saama['"]\s*\}/i.test(String(html ?? ''))
      || /jobs\.jobvite\.com\/__assets__\/scripts\/careersite\/public\/iframe\.js/i.test(String(html ?? ''))
      ? JOB_BOARD_URL
      : null
  }
  if (/\/careers\/saama\/search$/i.test(raw)) return JOB_BOARD_URL
  return toAbsoluteUrl(raw, JOB_BOARD_URL)
}

export const hasOfficialJobBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Current Openings/i.test(text)
    && /Powered by Jobvite/i.test(text)
    && /href=["'][^"']*\/saama\/job\/[^"']+["']/i.test(page)
}

export const extractJobBoardListings = (html = '') => {
  const listings = []
  const page = String(html ?? '')

  for (const sectionMatch of page.matchAll(
    /<section[^>]*class=["'][^"']*\bcategory\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
  )) {
    const sectionHtml = sectionMatch[1]
    const department = firstMatch(sectionHtml, [
      /<h3[^>]*>([\s\S]*?)<\/h3>/i,
    ])

    for (const rowMatch of sectionHtml.matchAll(
      /<div[^>]*class=["'][^"']*\bjob-row\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    )) {
      const rowHtml = rowMatch[1]
      const href = firstMatch(rowHtml, [
        /<a[^>]*href=["']([^"']+)["']/i,
      ])
      const title = firstMatch(rowHtml, [
        /<a[^>]*>([\s\S]*?)<\/a>/i,
      ])
      const detailUrl = toAbsoluteUrl(href)
      const jobId = detailUrl?.match(/\/job\/([^/?#]+)/i)?.[1] ?? null

      if (!title || !detailUrl || !jobId) continue

      listings.push({
        title,
        department,
        detailUrl,
        jobId,
        fallbackLocation: firstMatch(rowHtml, [
          /<span[^>]*class=["'][^"']*\bjob-location\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
        ]),
      })
    }
  }

  for (const sectionMatch of page.matchAll(
    /<h3[^>]*class=["'][^"']*\bh2\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*class=["'][^"']*\bh2\b|<hr\b|<\/article>|<\/body>|$)/gi,
  )) {
    const department = normalizeText(sectionMatch[1]) || null
    const sectionHtml = sectionMatch[2]

    for (const rowMatch of sectionHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = rowMatch[1]
      const href = firstMatch(rowHtml, [
        /<a[^>]*href=["']([^"']+)["']/i,
      ])
      const title = firstMatch(rowHtml, [
        /<a[^>]*>([\s\S]*?)<\/a>/i,
      ])
      const detailUrl = toAbsoluteUrl(href)
      const jobId = detailUrl?.match(/\/job\/([^/?#]+)/i)?.[1] ?? null
      const fallbackLocation = firstMatch(rowHtml, [
        /<td[^>]*class=["'][^"']*\bjv-job-list-location\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
      ])

      if (!title || !detailUrl || !jobId) continue

      listings.push({
        title,
        department,
        detailUrl,
        jobId,
        fallbackLocation,
      })
    }
  }

  return listings
}

const extractDescriptionHtml = (html = '') =>
  String(html ?? '').match(
    /<h3[^>]*>\s*Description\s*<\/h3>([\s\S]*?)(?:<p[^>]*>\s*Powered by Jobvite\s*<\/p>|<\/body>|<\/main>)/i,
  )?.[1] ?? ''

const extractVisibleLocation = (html = '', listing = {}) => {
  const text = normalizeWhitespace(html)
  if (!text || !listing?.title) return listing?.fallbackLocation || null

  const titlePattern = escapeRegExp(listing.title)
  const departmentPattern = listing.department ? `(?:${escapeRegExp(listing.department)}\\s+)?` : ''
  const explicitLocation = text.match(
    new RegExp(`${titlePattern}\\s+${departmentPattern}([A-Za-z0-9 .,&()\\/-]+?,\\s*India)\\s+Apply\\b`, 'i'),
  )?.[1]

  return normalizeText(explicitLocation) || listing?.fallbackLocation || null
}

export const extractJobDetail = (html = '', listing = {}) => {
  const descriptionHtml = extractDescriptionHtml(html)
  const description = normalizeText(descriptionHtml)?.replace(/\n+/g, ' ') || null
  const resolvedFallbackLocation = extractVisibleLocation(html, listing)
  const fallbackParts = parseLocationParts(resolvedFallbackLocation)
  const city = extractJsonLdValue(html, 'addressLocality') || fallbackParts.city
  const state = extractJsonLdValue(html, 'addressRegion') || fallbackParts.state
  const country = extractJsonLdValue(html, 'addressCountry') || fallbackParts.country

  if (!isIndiaCountry(country)) return null

  return {
    title: firstMatch(html, [
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
    ]) || listing.title || null,
    company: COMPANY,
    department: listing.department || null,
    location: normalizeLocation({
      city,
      state,
      country,
      fallback: {
        ...fallbackParts,
        location: resolvedFallbackLocation,
      },
    }),
    city: normalizeText(city),
    state: normalizeText(state),
    country: 'India',
    jobId: listing.jobId || null,
    requisitionId: listing.jobId || null,
    sourceUrl: listing.detailUrl || buildDetailUrl(listing.jobId),
    applyUrl: listing.jobId ? buildApplyUrl(listing.jobId) : null,
    employmentType: null,
    experienceRequired: extractExperienceRequired(description),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

export const createSaamaTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Saama Technologies verified careers page no longer matches the trusted first-party surface')
    }

    const jobBoardUrl = extractJobBoardUrl(careersHtml)
    if (jobBoardUrl !== JOB_BOARD_URL) {
      throw new Error('Saama Technologies verified careers page no longer resolves to the trusted Jobvite board')
    }

    const boardHtml = await fetchText(jobBoardUrl)
    if (!hasOfficialJobBoardSignal(boardHtml)) {
      throw new Error('Saama Technologies verified Jobvite board no longer matches the trusted public jobs surface')
    }

    const listings = extractJobBoardListings(boardHtml)
    if (listings.length === 0) {
      throw new Error('Saama Technologies verified Jobvite board no longer exposes trusted public jobs listings')
    }

    const jobs = []
    for (const listing of listings) {
      const detailHtml = await fetchText(listing.detailUrl)
      const job = extractJobDetail(detailHtml, listing)
      if (job) jobs.push(job)
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSaamaTechnologiesScraper(options).run()

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
