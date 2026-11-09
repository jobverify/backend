import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {runNativeExperion} from './nativeRun.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'experiontechnologies'
export const COMPANY = 'Experion Technologies'
export const HOMEPAGE_URL = 'https://experionglobal.com/'
export const CAREERS_URL = 'https://experionglobal.com/job-openings/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/aside|\/header|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<(p|div|li|ul|ol|section|article|aside|header|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  if (!value) return null

  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts.at(-1) || null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const parts = String(value ?? '')
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length === 0) return null

  if (!parts.some((part) => /^india$/i.test(part))) {
    parts.push('India')
  }

  return parts.join(', ')
}

const deriveCity = (location) => {
  const parts = String(location ?? '')
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return parts.find((part) => !/^(remote|hybrid|india)$/i.test(part)) || null
}

const deriveRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location) || ''
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const extractMetaItems = (html) => [...String(html ?? '').matchAll(
  /<span\b[^>]*class=["'][^"']*\bmeta-item\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractSectionHtml = (html, className) => {
  const match = String(html ?? '').match(
    new RegExp(`<div\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
  )

  return match?.[1] || null
}

const buildJobDescription = (html) => {
  const descriptionHtml = extractSectionHtml(html, 'job-description')
  if (!descriptionHtml) return null

  const segments = [...String(descriptionHtml).matchAll(/<(h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripTags(match[2]))
    .filter(Boolean)

  return normalizeWhitespace(segments.join(' '))
}

const hasExplicitEmptyState = (html) => /no (open )?(positions|openings|jobs)/i.test(stripTags(html) || '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /href=["']https:\/\/experionglobal\.com\/job-openings\/["']/i.test(page)
    && /href=["']https:\/\/experionglobal\.com\/life-at-experion\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Explore Exciting IT Career Opportunities at Experion Technologies/i.test(page)
    && /career-jobs-container/i.test(page)
    && /career-job-row/i.test(page)
    && /career-job-title/i.test(page)
    && /https:\/\/experionglobal\.com\/jobs\//i.test(page)
  }

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Experion Technologies official careers surface changed; refusing to scrape')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']*\/jobs\/[^"']+\/?)["'][^>]*class=["'][^"']*\bcareer-job-row\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const sourceUrl = buildAbsoluteUrl(match[1], CAREERS_URL)
    const cardHtml = match[2]
    const title = stripTags(
      cardHtml.match(/<h3\b[^>]*class=["'][^"']*\bcareer-job-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1],
    )
    const [experienceRequired, employmentType, rawLocation] = extractMetaItems(cardHtml)
    const location = normalizeLocation(rawLocation)
    const jobId = slugFromUrl(sourceUrl)

    if (!sourceUrl || !title || !location || !jobId || seen.has(sourceUrl)) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: deriveCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: employmentType || null,
      experienceRequired: experienceRequired || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: deriveRemoteStatus(location),
    })
  }

  if (jobs.length === 0) {
    if (hasExplicitEmptyState(html)) return []
    throw new Error('Experion Technologies official careers surface changed; refusing to scrape')
  }

  return jobs
}

const hasOfficialDetailSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /class=["'][^"']*\bjob-title\b/i.test(page)
    && /Apply for this position/i.test(text)
    && /class=["'][^"']*\bwpcf7-form\b/i.test(page)
    && /class=["'][^"']*\bjob-description\b/i.test(page)
}

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialDetailSignal(html)) {
    throw new Error('Experion Technologies official job detail surface changed; refusing to scrape')
  }

  const title = stripTags(
    String(html ?? '').match(/<h1\b[^>]*class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  ) || listing.title || null
  const experienceRequired = stripTags(
    String(html ?? '').match(/<strong>\s*Total Experience:\s*<\/strong>([\s\S]*?)<\/span>/i)?.[1],
  ) || listing.experienceRequired || null
  const location = normalizeLocation(
    stripTags(String(html ?? '').match(/<strong>\s*Job Location:\s*<\/strong>([\s\S]*?)<\/span>/i)?.[1]),
  ) || listing.location || null

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: deriveCity(location),
    country: 'India',
    jobId: listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    requisitionId: listing.requisitionId || listing.jobId || slugFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.sourceUrl || null,
    employmentType: listing.employmentType || null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(html),
    remoteStatus: deriveRemoteStatus(location),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createExperionTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Experion Technologies official homepage signal changed; refusing to scrape')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const listings = extractListings(careersHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    return attachInventoryEvidence(jobs.map(job=>({...job,sourceListingComplete:false})),{status:'discovery-only',surface:CAREERS_URL,firstParty:true,listingComplete:false,reason:'legacy-text-only-path-without-current-native-proof'})
  },
})

export const run = runNativeExperion

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Experion Technologies India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
