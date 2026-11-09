import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import NETXCELL_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = NETXCELL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const DETAIL_PAGE_URLS = [...PROVIDER_METADATA.detailPageUrls]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(String(value ?? ''))

const makeAbsoluteUrl = (value, base = CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), base).toString()
  } catch {
    return null
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

const deriveCity = (location) => {
  if (!location) return null

  const normalized = String(location).trim()
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'
  if (/\bor\b/i.test(normalized) || normalized.includes('(') || normalized.split(',').length > 2) {
    return null
  }

  return normalized.split(',')[0]?.trim() || null
}

const extractSectionBlock = (html, headings = []) => {
  for (const heading of headings) {
    const headingPattern = heading
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+')
    const match = String(html ?? '').match(
      new RegExp(
        `<h4[^>]*>\\s*(?:<b[^>]*>)?${headingPattern}\\s*(?:<\\/b>)?\\s*<\\/h4>([\\s\\S]*?)(?=<h4[^>]*>|<div[^>]*text-extra-dark-gray|<footer|<script|$)`,
        'i',
      ),
    )

    if (match?.[1]) {
      return stripHtml(match[1])
    }
  }

  return null
}

const extractJobTitleFromDetail = (html = '') => {
  const match = String(html ?? '').match(
    /<b[^>]*>\s*Job Description:\s*<\/b>\s*([\s\S]*?)<\/h4>/i,
  )
  return stripHtml(match?.[1])
}

const extractLocationFromDetail = (html = '') => {
  const match = String(html ?? '').match(
    /fa-map-marker[\s\S]*?<\/i>\s*<\/b>\s*([^<]+)/i,
  )
  return stripHtml(match?.[1])
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Career \| Next Gen Video Messaging System in India - Netxcell\s*<\/title>/i.test(
    rawHtml,
  )
    && normalized.includes('CAREERS')
    && normalized.includes('Senior CPaaS Sales Manager / Enterprise sales Manager.')
    && normalized.includes('AR Calling Experience (Accounts Receivable Calling) - RCMS - Hyderabad')
    && normalized.includes('Business Development Manager - e-Governance')
    && normalized.includes('Linux Administrator')
    && /enterprise-sales-manager\.php/i.test(rawHtml)
    && /arcallingexperience\.php/i.test(rawHtml)
    && /business-development-mannager\.php/i.test(rawHtml)
    && /linux-administrator\.php/i.test(rawHtml)
    && normalized.includes('Netxcell Limited')
}

export const hasOfficialJobDetailSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Netxcell-Job Overview\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Job Description:')
    && normalized.includes('Please fill the following form along with your resume to apply to Job.')
    && normalized.includes('Netxcell Limited')
}

export const extractJobCards = (html = '') => {
  const cards = []

  for (const match of String(html ?? '').matchAll(
    /<h3 class="jobheadding">\s*([\s\S]*?)\s*<\/h3>([\s\S]*?)<a href="([^"]+\.php)"[^>]*>\s*Apply\s*<\/a>/gi,
  )) {
    const title = stripHtml(match[1])
    const block = match[2]
    const jobContentHtml = block.match(/<p class="jobcontent">([\s\S]*?)<\/p>/i)?.[1] ?? block
    const location = stripHtml(
      jobContentHtml.match(/fa-map-marker[\s\S]*?<\/i>\s*([^<]+)/i)?.[1],
    )
    const summary = stripHtml(jobContentHtml.replace(/<br\s*\/?>[\s\S]*$/i, ''))
    const detailUrl = makeAbsoluteUrl(match[3], CAREERS_URL)

    if (!title || !detailUrl) continue

    cards.push({
      title,
      location: location || null,
      summary: summary || null,
      detailUrl,
    })
  }

  return cards
}

const mapJob = (card, detailHtml) => {
  const title = extractJobTitleFromDetail(detailHtml) || card.title
  const location = extractLocationFromDetail(detailHtml) || card.location
  const jobDescription = [
    extractSectionBlock(detailHtml, ['Position Overview:', 'Job Role:', 'Role and Responsibilities:']),
    extractSectionBlock(detailHtml, ['Key Responsibilities:']),
  ]
    .filter(Boolean)
    .join('\n\n') || card.summary || null
  const minimumQualification = extractSectionBlock(detailHtml, [
    'Qualifications:',
    'Desired Candidate Profile:',
    'Requirements:',
  ])
  const preferredQualification = extractSectionBlock(detailHtml, [
    'Why Join Us ?',
    'Perks and Benefits:',
  ])
  const detailUrl = card.detailUrl
  const jobId = new URL(detailUrl).pathname.split('/').pop()?.replace(/\.php$/i, '') || null

  return {
    title,
    company: COMPANY,
    location: location || null,
    city: deriveCity(location),
    country: 'India',
    link: detailUrl,
    applyUrl: detailUrl,
    sourceUrl: detailUrl,
    source: SOURCE,
    jobId,
    requisitionId: null,
    department: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription,
    minimumQualification,
    preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: new Date().toISOString(),
  }
}

export const createNetxcellScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Netxcell official careers page changed materially')
    }

    const cards = extractJobCards(careersHtml)
    if (cards.length === 0) {
      throw new Error('Netxcell careers page no longer exposes the verified first-party job card structure')
    }

    const cardsToFetch = Number.isFinite(maxJobs) ? cards.slice(0, maxJobs) : cards
    const jobs = []

    for (const card of cardsToFetch) {
      const detailHtml = await fetchText(card.detailUrl)
      if (!hasOfficialJobDetailSignal(detailHtml)) {
        throw new Error(`Netxcell job detail page changed materially: ${card.detailUrl}`)
      }

      jobs.push(mapJob(card, detailHtml))
    }

    return jobs
  },
})

export const run = async (options = {}) => createNetxcellScraper(options).run(options)

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
